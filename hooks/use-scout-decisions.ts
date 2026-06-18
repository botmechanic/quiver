import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type ScoutDecisionRow = {
  id: string;
  created_at: string;
  run_id: string;
  action: "buy" | "decline";
  endpoint: string;
  reason: string;
  confidence: number;
  price_usdc: string;
  payer: string | null;
};

const PAGE_SIZE = 50;

export function useScoutDecisions(runId: string | null) {
  const [decisions, setDecisions] = useState<ScoutDecisionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setDecisions([]);
    setLoading(true);

    const supabase = createClient();

    async function fetchInitial() {
      let query = supabase
        .from("scout_decisions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);

      if (runId) {
        query = query.eq("run_id", runId);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Failed to fetch scout decisions:", error.message);
        setDecisions([]);
      } else {
        setDecisions((data as ScoutDecisionRow[]).reverse());
      }
      setLoading(false);
    }

    const channelName = runId
      ? `scout-decisions-${runId}`
      : "scout-decisions-recent";

    const filter = runId ? `run_id=eq.${runId}` : undefined;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "scout_decisions",
          ...(filter ? { filter } : {}),
        },
        (payload) => {
          const row = payload.new as ScoutDecisionRow;
          if (runId && row.run_id !== runId) return;
          setDecisions((prev) => {
            if (prev.some((d) => d.id === row.id)) return prev;
            return [...prev, row].slice(-PAGE_SIZE);
          });
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          fetchInitial();
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [runId]);

  return { decisions, loading };
}
