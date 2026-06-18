import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { dedupeStreamEvents } from "@/lib/stream/constants";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type StreamEvent = {
  id: string;
  created_at: string;
  session_id: string;
  tick_number: number;
  amount_usdc: string;
  cumulative_usdc: string;
  verified_at: string;
  status: string;
  payer: string;
  endpoint: string;
  gateway_tx: string | null;
  raw: Record<string, unknown> | null;
};

export function useStreamEvents(sessionId: string | null) {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    setEvents([]);
    setLoading(true);

    const supabase = createClient();

    async function fetchInitial() {
      let query = supabase
        .from("stream_events")
        .select("*")
        .order("created_at", { ascending: true });

      if (sessionId) {
        query = query.eq("session_id", sessionId);
      }

      const { data, error } = await query.limit(sessionId ? 500 : 50);

      if (error) {
        console.error("Failed to fetch stream events:", error.message);
        setEvents([]);
      } else {
        setEvents(dedupeStreamEvents(data as StreamEvent[]));
      }
      setLoading(false);
    }

    const channel = supabase
      .channel(`stream-events-${sessionId ?? "all"}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "stream_events" },
        (payload) => {
          const row = payload.new as StreamEvent;
          if (sessionId && row.session_id !== sessionId) return;
          setEvents((prev) =>
            dedupeStreamEvents([
              ...prev.filter((e) => e.id !== row.id),
              row,
            ]),
          );
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          fetchInitial();
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  const latest = events.length > 0 ? events[events.length - 1] : null;

  return {
    events,
    loading,
    latest,
    tickCount: latest?.tick_number ?? 0,
    cumulativeUsdc: latest?.cumulative_usdc ?? "0.000000",
  };
}
