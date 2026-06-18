/**
 * Verify stream_events realtime delivery (anon key, same as dashboard).
 * Run while a stream is active, or after inserts.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const sessionId = process.argv[2] ?? null;
const timeoutMs = Number(process.argv[3] ?? "15000");

const supabase = createClient(url, anonKey);

let received = 0;
const seen: number[] = [];

const channel = supabase
  .channel("verify-stream-realtime")
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "stream_events" },
    (payload) => {
      const row = payload.new as { session_id: string; tick_number: number };
      if (sessionId && row.session_id !== sessionId) return;
      received++;
      seen.push(row.tick_number);
      console.log(`[realtime] INSERT tick ${row.tick_number} (total received: ${received})`);
    },
  )
  .subscribe(async (status) => {
    console.log(`[realtime] subscription status: ${status}`);
    if (status === "SUBSCRIBED") {
      console.log("[realtime] listening for stream_events INSERTs…");
      if (sessionId) {
        console.log(`[realtime] filtering session: ${sessionId}`);
      }
    }
  });

await new Promise((r) => setTimeout(r, timeoutMs));
await supabase.removeChannel(channel);

console.log(`\n[realtime] done — ${received} event(s) received via subscription`);
console.log(`[realtime] ticks seen: ${seen.join(", ") || "(none)"}`);
process.exit(received > 0 ? 0 : 1);
