/**
 * Phase-1 gate: can one funded ephemeral wallet issue many overlapping
 * long-validity EIP-3009 authorizations (~1/s) and have Gateway accept each?
 *
 * Throwaway — not wired into the app. Run:
 *   npm run spike:overlapping-auth
 */

import { GatewayClient } from "@circle-fin/x402-batching/client";
import { createClient } from "@supabase/supabase-js";
import {
  createPublicClient,
  createWalletClient,
  erc20Abi,
  formatUnits,
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
import { normalizeBaseUrl } from "../lib/utils.ts";

const ARC_TESTNET_USDC = "0x3600000000000000000000000000000000000000" as const;
const ARC_TESTNET_RPC = "https://rpc.testnet.arc.network";
const GAS_FUND_AMOUNT = parseEther("0.01");
const DEPOSIT_AMOUNT = process.env.SPIKE_DEPOSIT_AMOUNT ?? "0.01";
const TICK_COUNT = Number(process.env.SPIKE_TICK_COUNT ?? "10");
const TICK_INTERVAL_MS = Number(process.env.SPIKE_INTERVAL_MS ?? "1000");
const PAYMENT_SOURCE_HEADER = "x-quiver-payment-source";

interface TickResult {
  tick: number;
  accepted: boolean;
  latencyMs: number;
  amountUsdc: string | null;
  transaction: string | null;
  httpStatus: number | null;
  error: string | null;
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
        `[spike] ${label}: nonce collision, retrying in ${Math.round(delay)}ms...`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error("unreachable");
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name} — load via --env-file=.env.local`);
  }
  return value;
}

async function fundEphemeralWallet(
  funderAccount: PrivateKeyAccount,
): Promise<{ ephemeralKey: `0x${string}`; ephemeralAddress: Address }> {
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
  const usdcAmount = parseUnits(DEPOSIT_AMOUNT, 6);

  console.log(
    `[spike] Funding ephemeral ${ephemeralAccount.address} from funder ${funderAccount.address}`,
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

  return { ephemeralKey, ephemeralAddress: ephemeralAccount.address };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const funderKey = requireEnv("BUYER_PRIVATE_KEY") as `0x${string}`;
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const baseUrl = normalizeBaseUrl(
    process.env.BASE_URL ?? "https://quiver-self.vercel.app",
  );
  const targetUrl = `${baseUrl}/api/archer/market-state`;

  console.log("[spike] Overlapping-auth gate test");
  console.log(`[spike] Target: ${targetUrl}`);
  console.log(
    `[spike] Ticks: ${TICK_COUNT} @ ${TICK_INTERVAL_MS}ms (604900s validity per auth)`,
  );

  const funderAccount = privateKeyToAccount(funderKey);
  const { ephemeralKey, ephemeralAddress } =
    await fundEphemeralWallet(funderAccount);

  const gateway = new GatewayClient({
    chain: "arcTestnet",
    privateKey: ephemeralKey,
  });

  console.log(`[spike] Depositing ${DEPOSIT_AMOUNT} USDC into Gateway...`);
  await gateway.deposit(DEPOSIT_AMOUNT);
  const openingBalance = await gateway.getBalances();
  console.log(
    `[spike] Gateway available: ${openingBalance.gateway.formattedAvailable} USDC`,
  );

  const startedAt = new Date().toISOString();
  const results: TickResult[] = [];

  for (let tick = 1; tick <= TICK_COUNT; tick++) {
    const start = Date.now();
    try {
      const result = await gateway.pay(targetUrl, {
        method: "GET",
        headers: {
          [PAYMENT_SOURCE_HEADER]: "spike",
        },
      });
      const latencyMs = Date.now() - start;
      results.push({
        tick,
        accepted: true,
        latencyMs,
        amountUsdc: result.formattedAmount,
        transaction: result.transaction ?? null,
        httpStatus: result.status ?? 200,
        error: null,
      });
      console.log(
        `[spike] tick ${tick}/${TICK_COUNT} ACCEPTED ${result.formattedAmount} USDC (${latencyMs}ms) tx=${result.transaction?.slice(0, 14) ?? "n/a"}...`,
      );
    } catch (err) {
      const latencyMs = Date.now() - start;
      const message = err instanceof Error ? err.message : String(err);
      results.push({
        tick,
        accepted: false,
        latencyMs,
        amountUsdc: null,
        transaction: null,
        httpStatus: null,
        error: message,
      });
      console.error(
        `[spike] tick ${tick}/${TICK_COUNT} REJECTED (${latencyMs}ms): ${message}`,
      );
    }

    if (tick < TICK_COUNT) {
      await sleep(TICK_INTERVAL_MS);
    }
  }

  const closingBalance = await gateway.getBalances();
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: paymentRows, error: queryError } = await supabase
    .from("payment_events")
    .select("id, endpoint, payer, amount_usdc, gateway_tx, created_at, raw")
    .ilike("payer", ephemeralAddress)
    .eq("endpoint", "/api/archer/market-state")
    .gte("created_at", startedAt)
    .order("created_at", { ascending: true });

  if (queryError) {
    console.error(`[spike] Supabase query failed: ${queryError.message}`);
  }

  const accepted = results.filter((r) => r.accepted).length;
  const rejected = results.filter((r) => !r.accepted).length;
  const firstFailure = results.find((r) => !r.accepted);

  console.log("\n========== SPIKE SUMMARY ==========");
  console.log(`Ephemeral payer: ${ephemeralAddress}`);
  console.log(`Window started:  ${startedAt}`);
  console.log(
    `Gateway balance: ${openingBalance.gateway.formattedAvailable} -> ${closingBalance.gateway.formattedAvailable} USDC`,
  );
  console.log(`Ticks accepted:  ${accepted}/${TICK_COUNT}`);
  console.log(`Ticks rejected:  ${rejected}/${TICK_COUNT}`);
  console.log(
    `payment_events rows for this payer+endpoint: ${paymentRows?.length ?? 0}`,
  );

  if (paymentRows?.length) {
    for (const row of paymentRows) {
      console.log(
        `  - ${row.created_at} ${row.amount_usdc} USDC tx=${row.gateway_tx?.slice(0, 14) ?? "n/a"}...`,
      );
    }
  }

  console.log("\nPer-tick detail:");
  for (const r of results) {
    console.log(
      `  tick ${String(r.tick).padStart(2)} | ${r.accepted ? "OK  " : "FAIL"} | ${String(r.latencyMs).padStart(5)}ms | ${r.amountUsdc ?? "-"} | ${r.error ?? ""}`,
    );
  }

  let verdict: "GREEN" | "RED";
  if (accepted === TICK_COUNT) {
    verdict = "GREEN";
    console.log(
      `\nVERDICT: GREEN — all ${TICK_COUNT} overlapping per-second auths accepted from one ephemeral wallet.`,
    );
  } else {
    verdict = "RED";
    console.log(
      `\nVERDICT: RED — overlapping rapid auths failed (${accepted}/${TICK_COUNT} accepted).`,
    );
    if (firstFailure) {
      console.log(
        `First failure at tick ${firstFailure.tick}: ${firstFailure.error}`,
      );
    }
  }

  console.log("===================================\n");
  process.exit(verdict === "GREEN" ? 0 : 1);
}

main().catch((err) => {
  console.error("[spike] Fatal:", err instanceof Error ? err.message : err);
  process.exit(2);
});
