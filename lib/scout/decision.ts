/** Scout buys when confidence ≥ threshold and price ≤ confidence × remaining budget. */

export const SCOUT_CONFIDENCE_THRESHOLD = 0.45;

export interface ScoutPurchaseInput {
  endpoint: string;
  priceUsdc: number;
  confidence: number;
  remainingBudget: number;
  confidenceThreshold?: number;
}

export type ScoutDecision =
  | { action: "buy"; reason: string }
  | { action: "decline"; reason: string };

export function evaluatePurchase(input: ScoutPurchaseInput): ScoutDecision {
  const threshold = input.confidenceThreshold ?? SCOUT_CONFIDENCE_THRESHOLD;
  const { endpoint, priceUsdc, confidence, remainingBudget } = input;

  if (confidence < threshold) {
    return {
      action: "decline",
      reason: `confidence ${confidence.toFixed(2)} below ${threshold.toFixed(2)} threshold`,
    };
  }

  if (priceUsdc > remainingBudget) {
    return {
      action: "decline",
      reason: `price ${priceUsdc.toFixed(6)} USDC exceeds remaining budget ${remainingBudget.toFixed(6)} USDC`,
    };
  }

  const maxWilling = confidence * remainingBudget;
  if (priceUsdc > maxWilling) {
    return {
      action: "decline",
      reason: `price ${priceUsdc.toFixed(6)} USDC above max ${maxWilling.toFixed(6)} (confidence ${confidence.toFixed(2)} × budget ${remainingBudget.toFixed(6)} remaining)`,
    };
  }

  return {
    action: "buy",
    reason: `confidence ${confidence.toFixed(2)} ≥ ${threshold.toFixed(2)}, price ${priceUsdc.toFixed(6)} ≤ max ${maxWilling.toFixed(6)}`,
  };
}

export function formatScoutDecision(
  endpoint: string,
  decision: ScoutDecision,
): string {
  const verb = decision.action === "buy" ? "BOUGHT" : "DECLINED";
  return `[scout] ${verb} ${endpoint} — ${decision.reason}`;
}
