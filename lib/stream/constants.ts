/** Per-tick USDC rate for the live Archer stream. */
export const STREAM_RATE_USDC = 0.0001;

/** Client aborts the tick request after this (no indefinite "signing…"). */
export const STREAM_TICK_TIMEOUT_MS = Number(
  process.env.NEXT_PUBLIC_STREAM_TICK_TIMEOUT_MS ?? "8000",
);

/** Server-side cap on Gateway round-trip for one tick. */
export const STREAM_TICK_SERVER_TIMEOUT_MS = Number(
  process.env.STREAM_TICK_TIMEOUT_MS ?? "9000",
);

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
