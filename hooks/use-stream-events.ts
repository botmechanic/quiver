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
  const [loading, setLoading] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setEvents([]);
      setLoading(false);
      return;
    }

    setEvents([]);
    setLoading(true);

    const supabase = createClient();

    async function fetchInitial() {
      const { data, error } = await supabase
        .from("stream_events")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true })
        .limit(500);

      if (error) {
        console.error("Failed to fetch stream events:", error.message);
        setEvents([]);
      } else {
        setEvents(dedupeStreamEvents(data as StreamEvent[]));
      }
      setLoading(false);
    }

    const channel = supabase
      .channel(`stream-events-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "stream_events",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const row = payload.new as StreamEvent;
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
