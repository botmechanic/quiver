import type { ArcherTrace } from "./strategy";

export type ArcherEndpoint = "market-state" | "signal" | "compute";

export interface PriceQuote {
  /** Dollar string for x402, e.g. "$0.0014" */
  price: string;
  /** Settled amount as decimal string, e.g. "0.0014" */
  priceUsdc: string;
  reason: string;
  endpoint: ArcherEndpoint;
  confidence: number;
}

const BASE_USDC: Record<ArcherEndpoint, number> = {
  "market-state": 0.0001,
  signal: 0.001,
  compute: 0.003,
};

const FLOOR_USDC: Record<ArcherEndpoint, number> = {
  "market-state": 0.00005,
  signal: 0.0005,
  compute: 0.001,
};

const CEILING_USDC: Record<ArcherEndpoint, number> = {
  "market-state": 0.0003,
  signal: 0.003,
  compute: 0.01,
};

const roundPrice = (value: number) => Number(value.toFixed(6));

const clamp = (value: number, floor: number, ceiling: number) =>
  Math.min(ceiling, Math.max(floor, value));

const formatUsdc = (value: number) => roundPrice(value).toFixed(6);

const formatDollar = (value: number) => `$${formatUsdc(value)}`;

/** Weak edge (~0.45) → 0.85×; strong edge (~0.95) → 1.4× */
function confidenceMultiplier(confidence: number) {
  return 0.85 + (confidence - 0.45) * 1.1;
}

/** +10% per KB of submitted context (minimum 1 KB step). */
function computeContextMultiplier(byteLength: number) {
  const kb = Math.max(1, Math.ceil(byteLength / 1024));
  return 1 + (kb - 1) * 0.1;
}

function buildQuote(
  endpoint: ArcherEndpoint,
  trace: ArcherTrace,
  parts: string[],
  rawUsdc: number,
): PriceQuote {
  const usdc = clamp(rawUsdc, FLOOR_USDC[endpoint], CEILING_USDC[endpoint]);
  const reason = `${endpoint}: ${formatUsdc(usdc)} — ${parts.join("; ")}`;

  return {
    price: formatDollar(usdc),
    priceUsdc: formatUsdc(usdc),
    reason,
    endpoint,
    confidence: trace.confidence,
  };
}

export function quoteMarketState(trace: ArcherTrace): PriceQuote {
  const base = BASE_USDC["market-state"];
  return buildQuote("market-state", trace, [`base ${formatUsdc(base)} (cheap lookup)`], base);
}

export function quoteSignal(trace: ArcherTrace): PriceQuote {
  const base = BASE_USDC.signal;
  const mult = confidenceMultiplier(trace.confidence);
  const usdc = base * mult;

  return buildQuote(
    "signal",
    trace,
    [
      `base ${formatUsdc(base)}`,
      `×${mult.toFixed(2)} confidence ${trace.confidence.toFixed(2)}`,
    ],
    usdc,
  );
}

export function quoteCompute(trace: ArcherTrace, contextText: string): PriceQuote {
  const base = BASE_USDC.compute;
  const bytes = Buffer.byteLength(contextText, "utf8");
  const kb = Math.max(1, Math.ceil(bytes / 1024));
  const contextMult = computeContextMultiplier(bytes);
  const usdc = base * contextMult;

  const contextPart =
    bytes <= 1024
      ? `+${Math.round((contextMult - 1) * 100)}% for ${bytes}B context`
      : `+${Math.round((contextMult - 1) * 100)}% for ${kb}KB context`;

  return buildQuote(
    "compute",
    trace,
    [`base ${formatUsdc(base)}`, contextPart],
    usdc,
  );
}

export function logPriceQuote(quote: PriceQuote) {
  console.log(`[archer/pricing] ${quote.reason}`);
}
