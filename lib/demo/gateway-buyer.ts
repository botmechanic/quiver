import { GatewayClient } from "@circle-fin/x402-batching/client";
import {
  createPublicClient,
  createWalletClient,
  erc20Abi,
  formatUnits,
  http,
  parseEther,
  parseUnits,
} from "viem";
import { arcTestnet } from "viem/chains";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

export const PAYMENT_SOURCE_HEADER = "x-quiver-payment-source";

const ARC_TESTNET_USDC = "0x3600000000000000000000000000000000000000" as const;
const ARC_TESTNET_RPC = "https://rpc.testnet.arc.network";
const GAS_FUND_AMOUNT = parseEther("0.01");
const DEMO_DEPOSIT_AMOUNT = process.env.DEMO_DEPOSIT_AMOUNT ?? "0.01";
const MIN_DEMO_DEPOSIT = parseUnits("0.002", 6);
const REDEPOSIT_THRESHOLD = BigInt(100_000);

let gatewayPromise: Promise<GatewayClient> | null = null;

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

async function initDemoGateway(): Promise<GatewayClient> {
  const funderKey = process.env.BUYER_PRIVATE_KEY as `0x${string}` | undefined;
  if (!funderKey) {
    throw new Error("Missing BUYER_PRIVATE_KEY for demo-funded payments");
  }

  const ephemeralKey = generatePrivateKey();
  const ephemeralAccount = privateKeyToAccount(ephemeralKey);
  const funderAccount = privateKeyToAccount(funderKey);

  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(ARC_TESTNET_RPC),
  });
  const funderWallet = createWalletClient({
    account: funderAccount,
    chain: arcTestnet,
    transport: http(ARC_TESTNET_RPC),
  });

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

  const gateway = new GatewayClient({
    chain: "arcTestnet",
    privateKey: ephemeralKey,
  });

  console.log(
    `[demo/buyer] Depositing ${depositLabel} USDC into Gateway Wallet...`,
  );
  await gateway.deposit(depositLabel);

  return gateway;
}

async function getDemoGateway(): Promise<GatewayClient> {
  if (!gatewayPromise) {
    gatewayPromise = initDemoGateway().catch((err) => {
      gatewayPromise = null;
      throw err;
    });
  }
  return gatewayPromise;
}

async function ensureGatewayBalance(gateway: GatewayClient) {
  const balances = await gateway.getBalances();
  if (balances.gateway.available >= REDEPOSIT_THRESHOLD) return;

  if (balances.wallet.balance > BigInt(0)) {
    const topUp = formatUnits(balances.wallet.balance, 6);
    await gateway.deposit(topUp);
    return;
  }

  gatewayPromise = null;
  throw new Error(
    "Demo Gateway balance exhausted — refill the funder wallet or wait for cooldown",
  );
}

export function resolveBaseUrl(request: Request): string {
  if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/$/, "");
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
  const gateway = await getDemoGateway();
  await ensureGatewayBalance(gateway);

  const start = Date.now();
  const result = await gateway.pay(targetUrl, {
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
    payer: gateway.address,
    elapsedMs: Date.now() - start,
  };
}
