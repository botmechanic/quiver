import { createHash } from "crypto";

export type ArcherDecision = "buy" | "sell" | "hold";

export interface ArcherFactor {
  name: string;
  value: number | string;
  weight: number;
  explanation: string;
}

export interface ArcherTrace {
  agent: "Archer";
  strategy_version: "placeholder-v0";
  symbol: string;
  decision: ArcherDecision;
  confidence: number;
  factors: ArcherFactor[];
  generated_at: string;
}

const round = (value: number, decimals = 4) =>
  Number(value.toFixed(decimals));

function seededWave(seed: number, phase = 0) {
  return Math.sin(seed * 12.9898 + phase) * 43758.5453 % 1;
}

function scoreToDecision(score: number): ArcherDecision {
  if (score > 0.18) return "buy";
  if (score < -0.18) return "sell";
  return "hold";
}

export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
    .join(",")}}`;
}

export function hashTrace(trace: ArcherTrace) {
  return createHash("sha256").update(canonicalize(trace)).digest("hex");
}

export function generateArcherTrace(
  symbol = "ARC-USDC",
  now = new Date(),
): ArcherTrace {
  const bucket = Math.floor(now.getTime() / 60_000);
  return generateArcherTraceFromSeed(symbol, bucket, now);
}

/** Per-second stream slice — tick shifts the seed so each paid tick differs. */
export function generateStreamTrace(
  tick: number,
  symbol = "ARC-USDC",
  now = new Date(),
): ArcherTrace {
  const secondBucket = Math.floor(now.getTime() / 1000);
  return generateArcherTraceFromSeed(symbol, secondBucket + tick * 997, now);
}

function generateArcherTraceFromSeed(
  symbol: string,
  seed: number,
  now: Date,
): ArcherTrace {
  const momentum = round(seededWave(seed, 0.1) * 2 - 1);
  const liquidity = round(Math.abs(seededWave(seed, 1.7)));
  const volatility = round(Math.abs(seededWave(seed, 3.1)));
  const score = round(momentum * 0.55 + liquidity * 0.25 - volatility * 0.2);
  // Signed score + volatility: weak/noisy edges can fall below Scout's 0.45 threshold.
  // (The prior abs(score) floor kept confidence ≥ 0.45 always — the confidence gate never fired.)
  const confidence = round(
    Math.min(0.95, Math.max(0.25, 0.5 + score * 0.55 - volatility * 0.25)),
    3,
  );

  return {
    agent: "Archer",
    strategy_version: "placeholder-v0",
    symbol,
    decision: scoreToDecision(score),
    confidence,
    factors: [
      {
        name: "momentum",
        value: momentum,
        weight: 0.55,
        explanation: "Minute-bucket directional pressure from the v0 signal model.",
      },
      {
        name: "liquidity",
        value: liquidity,
        weight: 0.25,
        explanation: "Estimated ease of entering or exiting the signal.",
      },
      {
        name: "volatility",
        value: volatility,
        weight: -0.2,
        explanation: "Higher short-term noise reduces Archer's conviction.",
      },
    ],
    generated_at: now.toISOString(),
  };
}

export function createTraceEnvelope(trace: ArcherTrace) {
  return {
    trace,
    trace_hash: hashTrace(trace),
    verification:
      "Recompute SHA-256 over the canonicalized trace object to verify this reasoning trace.",
  };
}
