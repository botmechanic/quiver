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
      reason: `Confidence too low (${confidence.toFixed(2)}) to justify this quote — Scout policy requires ≥ ${threshold.toFixed(2)}`,
    };
  }

  const maxWilling =
    Number.isFinite(remainingBudget) ? confidence * remainingBudget : null;

  if (priceUsdc > remainingBudget) {
    return {
      action: "decline",
      reason: `Quoted price $${priceUsdc.toFixed(6)} exceeds remaining budget $${remainingBudget.toFixed(6)} USDC`,
    };
  }

  if (maxWilling !== null && priceUsdc > maxWilling) {
    return {
      action: "decline",
      reason: `Price $${priceUsdc.toFixed(6)} above max willing $${maxWilling.toFixed(6)} (confidence × remaining budget)`,
    };
  }

  return {
    action: "buy",
    reason: maxWilling !== null
      ? `Worth it at $${priceUsdc.toFixed(6)} — confidence ${confidence.toFixed(2)} supports up to $${maxWilling.toFixed(6)} of remaining budget`
      : `Worth it at $${priceUsdc.toFixed(6)} — confidence ${confidence.toFixed(2)} meets Scout policy (≥ ${threshold.toFixed(2)})`,
  };
}

export function formatScoutDecision(
  endpoint: string,
  decision: ScoutDecision,
): string {
  const verb = decision.action === "buy" ? "BOUGHT" : "DECLINED";
  return `[scout] ${verb} ${endpoint} — ${decision.reason}`;
}
