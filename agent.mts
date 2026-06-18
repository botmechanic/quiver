import { GatewayClient } from "@circle-fin/x402-batching/client";
import {
  createWalletClient,
  createPublicClient,
  http,
  erc20Abi,
  parseUnits,
  parseEther,
} from "viem";
import { arcTestnet } from "viem/chains";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import * as readline from "node:readline/promises";
import { randomUUID } from "node:crypto";
import {
  evaluatePurchase,
  formatScoutDecision,
  SCOUT_CONFIDENCE_THRESHOLD,
} from "./lib/scout/decision.ts";
import { fetchArcherQuote } from "./lib/scout/quote.ts";
import { recordScoutDecision } from "./lib/scout/record-decision.ts";
import { normalizeBaseUrl } from "./lib/utils.ts";

// --- Parse CLI args ---
function parseArgs() {
  const args = process.argv.slice(2);
  let spendingLimit: number | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit" && args[i + 1]) {
      const val = parseFloat(args[i + 1]);
      if (isNaN(val) || val <= 0) {
        console.error("--limit must be a positive number (USDC amount)");
        process.exit(1);
      }
      spendingLimit = val;
      i++;
    }
  }

  return { spendingLimit };
}

let { spendingLimit } = parseArgs();
let totalSpent = 0;
let totalDeclined = 0;
let paused = false;

const ENV_DEPOSIT_AMOUNT = process.env.DEPOSIT_AMOUNT ?? "1";

/** Gateway deposit — when --limit is set, cap deposit to the limit (not the default 1 USDC). */
function resolveGatewayDepositAmount(limit: number | null): string {
  const envAmount = parseFloat(ENV_DEPOSIT_AMOUNT);
  if (limit !== null && limit < envAmount) {
    return limit.toFixed(6);
  }
  return ENV_DEPOSIT_AMOUNT;
}

const gatewayDepositAmount = resolveGatewayDepositAmount(spendingLimit);

function remainingBudget(): number {
  if (spendingLimit === null) return Number.POSITIVE_INFINITY;
  return Math.max(0, spendingLimit - totalSpent);
}

if (spendingLimit !== null) {
  console.log(`Spending limit: ${spendingLimit} USDC`);
  if (parseFloat(ENV_DEPOSIT_AMOUNT) > spendingLimit) {
    console.log(
      `Gateway deposit capped to ${gatewayDepositAmount} USDC (matches --limit)`,
    );
  }
}
console.log(
  `Scout rule: buy when confidence ≥ ${SCOUT_CONFIDENCE_THRESHOLD.toFixed(2)} and price ≤ confidence × remaining budget`,
);

async function promptForAllowance(): Promise<number> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(
      "\nSpending limit reached. Enter additional allowance in USDC (or 0 to quit): ",
    );
    const val = parseFloat(answer);
    if (isNaN(val) || val < 0) {
      console.error("Invalid amount. Exiting.");
      process.exit(0);
    }
    if (val === 0) {
      console.log(`Agent stopped. Total spent: ${totalSpent.toFixed(6)} USDC`);
      process.exit(0);
    }
    return val;
  } finally {
    rl.close();
  }
}

// --- Funder wallet (the one you funded via Circle faucet) ---
const funderKey = process.env.BUYER_PRIVATE_KEY as `0x${string}` | undefined;
if (!funderKey) {
  console.error(
    "Missing BUYER_PRIVATE_KEY. Run `npm run generate-wallets` first.",
  );
  process.exit(1);
}

const ARC_TESTNET_USDC = "0x3600000000000000000000000000000000000000" as const;
const ARC_TESTNET_RPC = "https://rpc.testnet.arc.network";

const BASE_URL = normalizeBaseUrl(process.env.BASE_URL ?? "http://localhost:3000");
const DEFAULT_PROD_ARCHER = "https://quiver-self.vercel.app";

async function assertArcherReachable(baseUrl: string): Promise<void> {
  const probeUrl = `${baseUrl}/api/archer/market-state`;
  try {
    const res = await fetch(probeUrl, { method: "GET" });
    if (res.status !== 402) {
      console.error(
        `Archer probe ${probeUrl} returned ${res.status}, expected 402`,
      );
      process.exit(1);
    }
  } catch (err) {
    const msg = (err as Error).message ?? "fetch failed";
    if (!process.env.BASE_URL && baseUrl.includes("localhost")) {
      console.error(
        `Cannot reach Archer at ${baseUrl} (${msg}).\n` +
          `  BASE_URL is not set in .env.local — add:\n` +
          `    BASE_URL=${DEFAULT_PROD_ARCHER}\n` +
          `  Or: BASE_URL=${DEFAULT_PROD_ARCHER} npm run agent`,
      );
    } else {
      console.error(`Cannot reach Archer at ${baseUrl}: ${msg}`);
    }
    process.exit(1);
  }
}

console.log(`Archer target: ${BASE_URL}`);
if (!process.env.BASE_URL) {
  console.warn(
    `  BASE_URL not set — defaulting to localhost. For deployed Archer, set BASE_URL=${DEFAULT_PROD_ARCHER} in .env.local`,
  );
}
await assertArcherReachable(BASE_URL);

const SCOUT_RUN_ID = randomUUID();
// Arc Gateway deposit (approve + deposit) needs more native USDC than a single pay tick.
const GAS_FUND_AMOUNT = parseEther("0.2");
const MIN_NATIVE_GAS = parseEther("0.005");
const MIN_NATIVE_FOR_DEPOSIT = parseEther("0.25");

const endpoints = [
  { url: `${BASE_URL}/api/archer/signal`, method: "GET" as const },
  { url: `${BASE_URL}/api/archer/market-state`, method: "GET" as const },
  {
    url: `${BASE_URL}/api/archer/compute`,
    method: "POST" as const,
    body: { prompt: "Scout requests Archer's deeper ARC-USDC read." },
  },
];

// --- Generate ephemeral wallet ---
const ephemeralKey = generatePrivateKey();
const ephemeralAccount = privateKeyToAccount(ephemeralKey);
console.log(`Ephemeral agent wallet: ${ephemeralAccount.address}`);
console.log(`Scout run id: ${SCOUT_RUN_ID} (decisions → dashboard)`);

// --- Fund the ephemeral wallet from the funder ---
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
  `Funding ephemeral wallet from funder ${funderAccount.address}...`,
);

const usdcAmount = parseUnits(gatewayDepositAmount, 6);

// Retry helper for nonce collisions when multiple agents fund from the same wallet concurrently.
// On collision the other agent's tx confirms first, shifting the nonce — a short retry resolves it.
async function withNonceRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  const MAX_RETRIES = 5;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const msg = (err as Error).message ?? "";
      const isNonceError =
        msg.includes("replacement transaction underpriced") ||
        msg.includes("nonce too low") ||
        msg.includes("already known");
      if (!isNonceError || attempt === MAX_RETRIES - 1) throw err;
      const delay = 1000 + Math.random() * 2000;
      console.log(`  ${label}: nonce collision, retrying in ${Math.round(delay)}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error("unreachable");
}

async function ensureEphemeralGas(
  reason: string,
  minBalance: bigint = MIN_NATIVE_GAS,
): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const native = await publicClient.getBalance({
      address: ephemeralAccount.address,
    });
    if (native >= minBalance) return;

    console.log(
      `  Topping up native gas (${reason}, have ${(Number(native) / 1e18).toFixed(4)} USDC)…`,
    );
    const gasTxHash = await withNonceRetry(
      () =>
        funderWallet.sendTransaction({
          to: ephemeralAccount.address,
          value: GAS_FUND_AMOUNT,
        }),
      "Gas top-up",
    );
    await publicClient.waitForTransactionReceipt({ hash: gasTxHash });
  }

  const final = await publicClient.getBalance({
    address: ephemeralAccount.address,
  });
  if (final < minBalance) {
    throw new Error(
      `Ephemeral wallet native gas too low after top-ups (${(Number(final) / 1e18).toFixed(4)} USDC, need ${(Number(minBalance) / 1e18).toFixed(4)})`,
    );
  }
}

// Send native USDC for gas, wait for confirmation, then send ERC-20 USDC.
// Sequential + retry ensures correct nonce ordering even with concurrent agents.
const gasTxHash = await withNonceRetry(
  () => funderWallet.sendTransaction({ to: ephemeralAccount.address, value: GAS_FUND_AMOUNT }),
  "Gas tx",
);
await publicClient.waitForTransactionReceipt({ hash: gasTxHash });
console.log(`  Gas funded (${gasTxHash.slice(0, 10)}...)`);

const usdcTxHash = await withNonceRetry(
  () => funderWallet.writeContract({
    address: ARC_TESTNET_USDC,
    abi: erc20Abi,
    functionName: "transfer",
    args: [ephemeralAccount.address, usdcAmount],
  }),
  "USDC tx",
);
await publicClient.waitForTransactionReceipt({ hash: usdcTxHash });
console.log(`  USDC transferred (${usdcTxHash.slice(0, 10)}...)`);


// --- Create GatewayClient with the ephemeral wallet ---
const gateway = new GatewayClient({
  chain: "arcTestnet",
  privateKey: ephemeralKey,
});

let index = 0;
let inFlight = 0;
let redepositing = false;
let paymentInterval: ReturnType<typeof setInterval>;
let balanceInterval: ReturnType<typeof setInterval>;

// Auto-redeposit when gateway balance drops below 25% of initial deposit.
const REDEPOSIT_THRESHOLD = usdcAmount / 4n || 100_000n;

async function depositToGateway() {
  await ensureEphemeralGas("before Gateway deposit", MIN_NATIVE_FOR_DEPOSIT);
  console.log(`Depositing ${gatewayDepositAmount} USDC into Gateway Wallet...`);
  const result = await gateway.deposit(gatewayDepositAmount);
  console.log(`Deposit complete! TX: ${result.depositTxHash}`);
  const updated = await gateway.getBalances();
  console.log(
    `Gateway available balance: ${updated.gateway.formattedAvailable}`,
  );
}

async function refundAndRedeposit() {
  // Transfer more USDC from funder to ephemeral, then deposit into Gateway
  const txHash = await withNonceRetry(
    () => funderWallet.writeContract({
      address: ARC_TESTNET_USDC,
      abi: erc20Abi,
      functionName: "transfer",
      args: [ephemeralAccount.address, usdcAmount],
    }),
    "Redeposit tx",
  );
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  await ensureEphemeralGas("before redeposit");
  await depositToGateway();
}

async function checkAndRedeposit() {
  if (redepositing || paused) return;
  redepositing = true;
  try {
    const balances = await gateway.getBalances();
    if (balances.gateway.available < REDEPOSIT_THRESHOLD) {
      console.log(
        `\nGateway balance low (${balances.gateway.formattedAvailable}), redepositing...`,
      );
      // Check if ephemeral wallet has USDC to deposit directly
      if (balances.wallet.balance > 0n) {
        await depositToGateway();
      } else {
        // Pull more from the funder
        await refundAndRedeposit();
      }
    }
  } catch (err) {
    console.error("Balance check failed:", (err as Error).message);
  } finally {
    redepositing = false;
  }
}

// Initial Gateway deposit
await depositToGateway();

console.log(
  `\nTarget: 1 transaction/second across ${endpoints.length} endpoints\n`,
);

// Check balance every 30 seconds and redeposit if low.
// Runs fully async — payments continue uninterrupted during deposit.
balanceInterval = setInterval(checkAndRedeposit, 30_000);

async function handleLimitReached() {
  if (spendingLimit === null) return;

  paused = true;
  clearInterval(paymentInterval);
  clearInterval(balanceInterval);

  // Wait for in-flight payments to settle
  while (inFlight > 0) {
    await new Promise((r) => setTimeout(r, 100));
  }

  console.log(`\nSpent ${totalSpent.toFixed(6)} / ${spendingLimit.toFixed(6)} USDC (limit reached)`);

  const additional = await promptForAllowance();
  spendingLimit += additional;
  console.log(`New limit: ${spendingLimit.toFixed(6)} USDC (total spent so far: ${totalSpent.toFixed(6)} USDC)`);

  paused = false;
  startPaymentLoop();
}

function startPaymentLoop() {
  balanceInterval = setInterval(checkAndRedeposit, 30_000);

  paymentInterval = setInterval(() => {
    if (paused) return;

    const ep = endpoints[index % endpoints.length];
    index++;
    inFlight++;

    void handleEndpoint(ep, index);
  }, 1000);
}

async function handleEndpoint(
  ep: (typeof endpoints)[number],
  callIndex: number,
) {
  const path = new URL(ep.url).pathname;
  const start = Date.now();

  try {
    const quote = await fetchArcherQuote(ep.url, {
      method: ep.method,
      body: ep.body,
    });
    const decision = evaluatePurchase({
      endpoint: path,
      priceUsdc: quote.priceUsdc,
      confidence: quote.confidence,
      remainingBudget: remainingBudget(),
    });

    await recordScoutDecision({
      runId: SCOUT_RUN_ID,
      action: decision.action,
      endpoint: path,
      reason: decision.reason,
      confidence: quote.confidence,
      priceUsdc: quote.priceUsdc,
      payer:
        decision.action === "buy" ? ephemeralAccount.address : undefined,
    });

    if (decision.action === "decline") {
      totalDeclined++;
      const ms = Date.now() - start;
      console.log(
        `#${callIndex} ${formatScoutDecision(path, decision)} (${ms}ms) [declined: ${totalDeclined}]`,
      );
      return;
    }

    const result = await gateway.pay(ep.url, {
      method: ep.method,
      body: ep.body,
      headers: { "x-quiver-payment-source": "scout" },
    });
    const ms = Date.now() - start;
    const amount = parseFloat(result.formattedAmount);
    totalSpent += amount;

    const limitInfo =
      spendingLimit !== null
        ? ` [spent: ${totalSpent.toFixed(6)}/${spendingLimit.toFixed(6)} USDC]`
        : "";
    console.log(
      `#${callIndex} ${formatScoutDecision(path, decision)} -> ${result.formattedAmount} USDC (${ms}ms) [in-flight: ${inFlight - 1}]${limitInfo}`,
    );

    if (spendingLimit !== null && totalSpent >= spendingLimit) {
      handleLimitReached();
    }
  } catch (err) {
    const ms = Date.now() - start;
    console.error(
      `#${callIndex} ${path.split("/").pop()} FAILED (${ms}ms): ${(err as Error).message} [in-flight: ${inFlight - 1}]`,
    );
  } finally {
    inFlight--;
  }
}

startPaymentLoop();
