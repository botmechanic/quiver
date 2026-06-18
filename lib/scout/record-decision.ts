import { createClient } from "@supabase/supabase-js";

export interface RecordScoutDecisionInput {
  runId: string;
  action: "buy" | "decline";
  endpoint: string;
  reason: string;
  confidence: number;
  priceUsdc: number;
  payer?: string;
}

export async function recordScoutDecision(
  input: RecordScoutDecisionInput,
): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn(
      "[scout] Skipping decision record — Supabase env not configured",
    );
    return;
  }

  const supabase = createClient(url, key);
  const { error } = await supabase.from("scout_decisions").insert({
    run_id: input.runId,
    action: input.action,
    endpoint: input.endpoint,
    reason: input.reason,
    confidence: input.confidence,
    price_usdc: input.priceUsdc.toFixed(6),
    payer: input.payer ?? null,
  });

  if (error) {
    console.error("[scout] Failed to record decision:", error.message);
  }
}
