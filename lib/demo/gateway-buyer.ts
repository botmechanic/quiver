import { GatewayClient } from "@circle-fin/x402-batching/client";
import {
  createPublicClient,
  createWalletClient,
  erc20Abi,
  formatUnits,
  http,
  parseEther,
  parseUnits,
  type Address,
  type PublicClient,
} from "viem";
import { arcTestnet } from "viem/chains";
import {
  generatePrivateKey,
  privateKeyToAccount,
  type PrivateKeyAccount,
} from "viem/accounts";
import { normalizeBaseUrl } from "@/lib/utils";

export const PAYMENT_SOURCE_HEADER = "x-quiver-payment-source";

const ARC_TESTNET_USDC = "0x3600000000000000000000000000000000000000" as const;
const ARC_TESTNET_RPC = "https://rpc.testnet.arc.network";
const GAS_FUND_AMOUNT = parseEther("0.01");
const MIN_NATIVE_GAS = parseEther("0.005");
const DEMO_DEPOSIT_AMOUNT = process.env.DEMO_DEPOSIT_AMOUNT ?? "0.01";
const MIN_DEMO_DEPOSIT = parseUnits("0.002", 6);
const REDEPOSIT_THRESHOLD = BigInt(100_000);

interface DemoSession {
  gateway: GatewayClient;
  ephemeralAddress: Address;
  funderAccount: PrivateKeyAccount;
  publicClient: PublicClient;
}

let sessionPromise: Promise<DemoSession> | null = null;

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
        `[demo/buyer] ${label}: nonce collision, retrying in ${Math.round(delay)}ms...`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error("unreachable");
}

function getFunderAccount(): PrivateKeyAccount {
  const funderKey = process.env.BUYER_PRIVATE_KEY as `0x${string}` | undefined;
  if (!funderKey) {
    throw new Error("Missing BUYER_PRIVATE_KEY for demo-funded payments");
  }
  return privateKeyToAccount(funderKey);
}

function createFunderWallet(funderAccount: PrivateKeyAccount) {
  return createWalletClient({
    account: funderAccount,
    chain: arcTestnet,
    transport: http(ARC_TESTNET_RPC),
  });
}

async function ensureEphemeralGas(
  session: DemoSession,
  reason: string,
): Promise<void> {
  const native = await session.publicClient.getBalance({
    address: session.ephemeralAddress,
  });

  if (native >= MIN_NATIVE_GAS) return;

  console.log(
    `[demo/buyer] Topping up native gas for ${session.ephemeralAddress} (${reason})`,
  );

  const funderWallet = createFunderWallet(session.funderAccount);
  const gasTxHash = await withNonceRetry(
    () =>
      funderWallet.sendTransaction({
        to: session.ephemeralAddress,
        value: GAS_FUND_AMOUNT,
      }),
    "Gas top-up",
  );
  await session.publicClient.waitForTransactionReceipt({ hash: gasTxHash });
}

async function initDemoSession(): Promise<DemoSession> {
  const funderAccount = getFunderAccount();
  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(ARC_TESTNET_RPC),
  });
  const funderWallet = createFunderWallet(funderAccount);

  const ephemeralKey = generatePrivateKey();
  const ephemeralAccount = privateKeyToAccount(ephemeralKey);

  console.log(
    `[demo/buyer] Funding ephemeral wallet ${ephemeralAccount.address} from funder ${funderAccount.address}`,
  );

  const requestedDeposit = parseUnits(DEMO_DEPOSIT_AMOUNT, 6);
  const funderBalance = await publicClient.readContract({
    address: ARC_TESTNET_USDC,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [funderAccount.address],
  });

  const usdcAmount =
    funderBalance < requestedDeposit ? funderBalance : requestedDeposit;

  if (usdcAmount < MIN_DEMO_DEPOSIT) {
    throw new Error(
      `Funder wallet too low for demo buys (${formatUnits(funderBalance, 6)} USDC available)`,
    );
  }

  const depositLabel = formatUnits(usdcAmount, 6);

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

  const session: DemoSession = {
    gateway: new GatewayClient({
      chain: "arcTestnet",
      privateKey: ephemeralKey,
    }),
    ephemeralAddress: ephemeralAccount.address,
    funderAccount,
    publicClient,
  };

  await ensureEphemeralGas(session, "before initial deposit");

  console.log(
    `[demo/buyer] Depositing ${depositLabel} USDC into Gateway Wallet...`,
  );
  await session.gateway.deposit(depositLabel);

  return session;
}

async function getDemoSession(): Promise<DemoSession> {
  if (!sessionPromise) {
    sessionPromise = initDemoSession().catch((err) => {
      sessionPromise = null;
      throw err;
    });
  }
  return sessionPromise;
}

async function ensureGatewayBalance(session: DemoSession) {
  const balances = await session.gateway.getBalances();
  if (balances.gateway.available >= REDEPOSIT_THRESHOLD) return;

  if (balances.wallet.balance > BigInt(0)) {
    await ensureEphemeralGas(session, "before redeposit");
    const topUp = formatUnits(balances.wallet.balance, 6);
    await session.gateway.deposit(topUp);
    return;
  }

  sessionPromise = null;
  throw new Error(
    "Demo Gateway balance exhausted — refill the funder wallet or wait for cooldown",
  );
}

export function resolveBaseUrl(request: Request): string {
  if (process.env.BASE_URL) {
    return normalizeBaseUrl(process.env.BASE_URL);
  }
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  if (host) return `${proto}://${host}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export async function executeDemoBuy(
  targetUrl: string,
  options?: {
    method?: "GET" | "POST";
    body?: unknown;
  },
) {
  const session = await getDemoSession();
  await ensureGatewayBalance(session);

  const start = Date.now();
  const result = await session.gateway.pay(targetUrl, {
    method: options?.method ?? "GET",
    body: options?.body,
    headers: {
      [PAYMENT_SOURCE_HEADER]: "demo",
    },
  });

  return {
    data: result.data,
    amount: result.formattedAmount,
    transaction: result.transaction,
    payer: session.gateway.address,
    elapsedMs: Date.now() - start,
  };
}
