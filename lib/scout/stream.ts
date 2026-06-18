import { GatewayClient } from "@circle-fin/x402-batching/client";
import { randomUUID } from "node:crypto";
import {
  createPublicClient,
  createWalletClient,
  erc20Abi,
  http,
  parseEther,
  parseUnits,
  type Address,
} from "viem";
import { arcTestnet } from "viem/chains";
import {
  generatePrivateKey,
  privateKeyToAccount,
  type PrivateKeyAccount,
} from "viem/accounts";
import {
  PAYMENT_SOURCE_HEADER,
  STREAM_SESSION_HEADER,
  STREAM_TICK_HEADER,
} from "../stream/headers.ts";
import { STREAM_TICK_SERVER_TIMEOUT_MS } from "../stream/constants.ts";
import { withServerTimeout } from "../stream/fetch-with-timeout.ts";
import { normalizeBaseUrl } from "../utils.ts";

const ARC_TESTNET_USDC = "0x3600000000000000000000000000000000000000" as const;
const ARC_TESTNET_RPC = "https://rpc.testnet.arc.network";
const GAS_FUND_AMOUNT = parseEther("0.01");
const DEFAULT_TICK_INTERVAL_MS = 1000;
const DEFAULT_STREAM_RATE_USDC = 0.0001;

export interface StreamTickResult {
  tick: number;
  accepted: boolean;
  amountUsdc: string | null;
  cumulativeUsdc: string;
  latencyMs: number;
  transaction: string | null;
  error: string | null;
  feed?: {
    decision: string;
    confidence: number;
    generated_at: string;
  };
}

export interface StreamSession {
  sessionId: string;
  payer: Address;
  rateUsdc: number;
  tickCount: number;
  totalUsdc: number;
  running: boolean;
  stop: () => Promise<void>;
}

export interface StartStreamOptions {
  baseUrl?: string;
  depositAmount?: string;
  tickIntervalMs?: number;
  maxTicks?: number;
  maxSpendUsdc?: number;
  onTick?: (result: StreamTickResult) => void;
}

async function withNonceRetry<T>(
  fn: () => Promise<T>,
  label: string,
): Promise<T> {
  const maxRetries = 5;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const msg = (err as Error).message ?? "";
      const isNonceError =
        msg.includes("replacement transaction underpriced") ||
        msg.includes("nonce too low") ||
        msg.includes("already known");
      if (!isNonceError || attempt === maxRetries - 1) throw err;
      const delay = 1000 + Math.random() * 2000;
      console.log(
        `[scout/stream] ${label}: nonce collision, retrying in ${Math.round(delay)}ms...`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error("unreachable");
}

async function fundSessionWallet(
  funderAccount: PrivateKeyAccount,
  depositAmount: string,
): Promise<{
  gateway: GatewayClient;
  ephemeralAddress: Address;
}> {
  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(ARC_TESTNET_RPC),
  });
  const funderWallet = createWalletClient({
    account: funderAccount,
    chain: arcTestnet,
    transport: http(ARC_TESTNET_RPC),
  });

  const ephemeralKey = generatePrivateKey();
  const ephemeralAccount = privateKeyToAccount(ephemeralKey);
  const usdcAmount = parseUnits(depositAmount, 6);

  console.log(
    `[scout/stream] Funding session wallet ${ephemeralAccount.address} from funder ${funderAccount.address}`,
  );

  const gasTxHash = await withNonceRetry(
    () =>
      funderWallet.sendTransaction({
        to: ephemeralAccount.address,
        value: GAS_FUND_AMOUNT,
      }),
    "Gas tx",
  );
  await publicClient.waitForTransactionReceipt({ hash: gasTxHash });

  const usdcTxHash = await withNonceRetry(
    () =>
      funderWallet.writeContract({
        address: ARC_TESTNET_USDC,
        abi: erc20Abi,
        functionName: "transfer",
        args: [ephemeralAccount.address, usdcAmount],
      }),
    "USDC tx",
  );
  await publicClient.waitForTransactionReceipt({ hash: usdcTxHash });

  const gateway = new GatewayClient({
    chain: "arcTestnet",
    privateKey: ephemeralKey,
  });

  console.log(
    `[scout/stream] Depositing ${depositAmount} USDC into Gateway Wallet...`,
  );
  await gateway.deposit(depositAmount);

  return { gateway, ephemeralAddress: ephemeralAccount.address };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function startStream(
  options: StartStreamOptions = {},
): Promise<StreamSession> {
  const funderKey = process.env.BUYER_PRIVATE_KEY as `0x${string}` | undefined;
  if (!funderKey) {
    throw new Error("Missing BUYER_PRIVATE_KEY");
  }

  const baseUrl = normalizeBaseUrl(
    options.baseUrl ?? process.env.BASE_URL ?? "http://localhost:3000",
  );
  const targetUrl = `${baseUrl}/api/archer/stream`;
  const depositAmount = options.depositAmount ?? process.env.STREAM_DEPOSIT_AMOUNT ?? "0.01";
  const tickIntervalMs = options.tickIntervalMs ?? DEFAULT_TICK_INTERVAL_MS;
  const maxTicks = options.maxTicks ?? Number.POSITIVE_INFINITY;
  const maxSpendUsdc =
    options.maxSpendUsdc ?? Number.POSITIVE_INFINITY;

  const sessionId = randomUUID();
  const funderAccount = privateKeyToAccount(funderKey);
  const { gateway, ephemeralAddress } = await fundSessionWallet(
    funderAccount,
    depositAmount,
  );

  const state = {
    sessionId,
    payer: ephemeralAddress,
    rateUsdc: DEFAULT_STREAM_RATE_USDC,
    tickCount: 0,
    totalUsdc: 0,
    running: true,
    stopping: false,
  };

  let tickTimer: ReturnType<typeof setTimeout> | null = null;
  let tickInFlight = false;

  const runTick = async () => {
    if (!state.running || state.stopping) return;

    if (state.tickCount >= maxTicks) {
      state.running = false;
      return;
    }

    if (state.totalUsdc + state.rateUsdc > maxSpendUsdc) {
      console.log(
        `[scout/stream] Spend cap reached (${state.totalUsdc.toFixed(6)} USDC)`,
      );
      state.running = false;
      return;
    }

    tickInFlight = true;
    const tick = state.tickCount + 1;
    const start = Date.now();

    try {
      const result = await withServerTimeout(
        gateway.pay(targetUrl, {
          method: "GET",
          headers: {
            [PAYMENT_SOURCE_HEADER]: "stream",
            [STREAM_SESSION_HEADER]: sessionId,
            [STREAM_TICK_HEADER]: String(tick),
          },
        }),
        STREAM_TICK_SERVER_TIMEOUT_MS,
        "Stream tick",
      );

      const amount = parseFloat(result.formattedAmount);
      state.tickCount = tick;
      state.totalUsdc = Number((state.totalUsdc + amount).toFixed(6));

      const payload = result.data as {
        feed?: StreamTickResult["feed"];
      } | undefined;

      const tickResult: StreamTickResult = {
        tick,
        accepted: true,
        amountUsdc: result.formattedAmount,
        cumulativeUsdc: state.totalUsdc.toFixed(6),
        latencyMs: Date.now() - start,
        transaction: result.transaction ?? null,
        error: null,
        feed: payload?.feed,
      };

      options.onTick?.(tickResult);
      console.log(
        `[scout/stream] tick ${tick} verified ${result.formattedAmount} USDC (cum ${state.totalUsdc.toFixed(6)}) ${tickResult.latencyMs}ms decision=${tickResult.feed?.decision ?? "?"}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const tickResult: StreamTickResult = {
        tick,
        accepted: false,
        amountUsdc: null,
        cumulativeUsdc: state.totalUsdc.toFixed(6),
        latencyMs: Date.now() - start,
        transaction: null,
        error: message,
      };
      options.onTick?.(tickResult);
      console.error(`[scout/stream] tick ${tick} failed: ${message}`);
      state.running = false;
      if (message.includes("timed out")) {
        console.error(
          `[scout/stream] Session ${sessionId} closed fail-closed after ${state.tickCount} verified tick(s)`,
        );
      }
    } finally {
      tickInFlight = false;
      if (state.running && !state.stopping) {
        tickTimer = setTimeout(() => {
          void runTick();
        }, tickIntervalMs);
      }
    }
  };

  console.log(
    `[scout/stream] Session ${sessionId} -> ${targetUrl} @ ${state.rateUsdc} USDC/s`,
  );

  void runTick();

  return {
    get sessionId() {
      return state.sessionId;
    },
    get payer() {
      return state.payer;
    },
    get rateUsdc() {
      return state.rateUsdc;
    },
    get tickCount() {
      return state.tickCount;
    },
    get totalUsdc() {
      return state.totalUsdc;
    },
    get running() {
      return state.running;
    },
    stop: async () => {
      if (state.stopping) return;
      state.stopping = true;
      state.running = false;
      if (tickTimer) clearTimeout(tickTimer);

      while (tickInFlight) {
        await sleep(50);
      }

      console.log(
        `[scout/stream] Session ${sessionId} stopped after ${state.tickCount} ticks (${state.totalUsdc.toFixed(6)} USDC authorized)`,
      );
    },
  };
}

export function formatStreamRate(): string {
  return `${DEFAULT_STREAM_RATE_USDC.toFixed(4)} USDC/s`;
}

export async function waitForStream(session: StreamSession): Promise<void> {
  while (session.running) {
    await sleep(200);
  }
}
