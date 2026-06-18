/**
 * Scout stream CLI — Day 7 milestone: real per-second ticks via startStream.
 *
 * Run: npm run stream
 * Options: --ticks N  --limit USDC  --interval MS
 */

import { startStream, waitForStream } from "./lib/scout/stream.ts";

function parseArgs() {
  const args = process.argv.slice(2);
  let maxTicks = 10;
  let maxSpendUsdc: number | null = null;
  let tickIntervalMs = 1000;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--ticks" && args[i + 1]) {
      maxTicks = parseInt(args[i + 1], 10);
      if (!Number.isFinite(maxTicks) || maxTicks < 1) {
        console.error("--ticks must be a positive integer");
        process.exit(1);
      }
      i++;
    } else if (args[i] === "--limit" && args[i + 1]) {
      maxSpendUsdc = parseFloat(args[i + 1]);
      if (!Number.isFinite(maxSpendUsdc) || maxSpendUsdc <= 0) {
        console.error("--limit must be a positive USDC amount");
        process.exit(1);
      }
      i++;
    } else if (args[i] === "--interval" && args[i + 1]) {
      tickIntervalMs = parseInt(args[i + 1], 10);
      if (!Number.isFinite(tickIntervalMs) || tickIntervalMs < 100) {
        console.error("--interval must be at least 100ms");
        process.exit(1);
      }
      i++;
    }
  }

  return { maxTicks, maxSpendUsdc, tickIntervalMs };
}

const { maxTicks, maxSpendUsdc, tickIntervalMs } = parseArgs();

console.log(
  `Starting stream: ${maxTicks} ticks @ ${tickIntervalMs}ms` +
    (maxSpendUsdc !== null ? `, cap ${maxSpendUsdc} USDC` : ""),
);

const session = await startStream({
  maxTicks,
  maxSpendUsdc: maxSpendUsdc ?? undefined,
  tickIntervalMs,
});

const shutdown = async (signal: string) => {
  console.log(`\n[stream] ${signal} — stopping (no further auths will be signed)...`);
  await session.stop();
  console.log(
    `[stream] Final: ${session.tickCount} ticks, ${session.totalUsdc.toFixed(6)} USDC authorized`,
  );
  console.log(`[stream] Session id: ${session.sessionId}`);
  process.exit(0);
};

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

await waitForStream(session);

console.log(
  `\n[stream] Complete: ${session.tickCount} ticks, ${session.totalUsdc.toFixed(6)} USDC authorized`,
);
console.log(`[stream] Session id: ${session.sessionId}`);
console.log(`[stream] Payer: ${session.payer}`);
