/** Per-tick USDC rate for the live Archer stream. */
export const STREAM_RATE_USDC = 0.0001;

/** Steady-state client abort (after tick 1). Vercel + Gateway often need >8s. */
export const STREAM_TICK_TIMEOUT_MS = Number(
  process.env.NEXT_PUBLIC_STREAM_TICK_TIMEOUT_MS ?? "18000",
);

/** First tick includes cold start (demo session init + Gateway). */
export const STREAM_FIRST_TICK_TIMEOUT_MS = Number(
  process.env.NEXT_PUBLIC_STREAM_FIRST_TICK_TIMEOUT_MS ?? "30000",
);

/** Server-side cap on Gateway round-trip for one tick. */
export const STREAM_TICK_SERVER_TIMEOUT_MS = Number(
  process.env.STREAM_TICK_TIMEOUT_MS ?? "25000",
);

export function tickTimeoutMs(tickNumber: number): number {
  return tickNumber === 1 ? STREAM_FIRST_TICK_TIMEOUT_MS : STREAM_TICK_TIMEOUT_MS;
}

export function expectedStreamTotalUsdc(tickCount: number): string {
  return (tickCount * STREAM_RATE_USDC).toFixed(6);
}

export function buildStreamInvariant(tickCount: number) {
  const total = expectedStreamTotalUsdc(tickCount);
  const rate = STREAM_RATE_USDC.toFixed(4);
  return {
    tick_count: tickCount,
    authorized_total_usdc: total,
    rate_usdc: rate,
    invariant: {
      formula: `${tickCount} × ${rate} = ${total}`,
      holds: true,
    },
  };
}

/** Dedupe stream rows — keep highest cumulative per tick_number. */
export type StreamCloseReason = "user" | "tick_timeout" | "tick_failed";

/** Banner copy — always pass verified tick count from stream_events, not session row. */
export function streamCloseLabel(
  reason: StreamCloseReason,
  verifiedTickCount: number,
): string {
  if (reason === "user") {
    return "Stream stopped — no further authorizations will be signed for this session.";
  }
  const head =
    reason === "tick_timeout"
      ? "Stream closed — tick timed out. No further authorizations signed; you pay only for verified ticks."
      : "Stream closed — tick failed. No further authorizations signed; you pay only for verified ticks.";
  return `${head} Charged for ${verifiedTickCount} verified tick(s).`;
}

export function dedupeStreamEvents<
  T extends { id: string; tick_number: number; cumulative_usdc: string },
>(events: T[]): T[] {
  const byTick = new Map<number, T>();
  for (const ev of events) {
    const existing = byTick.get(ev.tick_number);
    if (!existing) {
      byTick.set(ev.tick_number, ev);
      continue;
    }
    if (
      parseFloat(ev.cumulative_usdc) >= parseFloat(existing.cumulative_usdc)
    ) {
      byTick.set(ev.tick_number, ev);
    }
  }
  return [...byTick.values()].sort((a, b) => a.tick_number - b.tick_number);
}
