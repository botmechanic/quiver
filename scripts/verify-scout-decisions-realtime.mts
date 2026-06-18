/**
 * Verify scout_decisions realtime delivery (anon key, same as dashboard).
 * Run while `npm run agent` is active, or after manual inserts.
 *
 * Usage: npm run verify:scout-decisions [timeoutMs]
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const timeoutMs = Number(process.argv[2] ?? "20000");

const supabase = createClient(url, anonKey);

let received = 0;
const seen: string[] = [];

const channel = supabase
  .channel("verify-scout-decisions-realtime")
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "scout_decisions" },
    (payload) => {
      const row = payload.new as {
        action: string;
        endpoint: string;
        reason: string;
      };
      received++;
      seen.push(`${row.action}:${row.endpoint}`);
      console.log(
        `[realtime] ${row.action.toUpperCase()} ${row.endpoint} — ${row.reason.slice(0, 80)}…`,
      );
    },
  )
  .subscribe((status) => {
    console.log(`[realtime] subscription status: ${status}`);
    if (status === "SUBSCRIBED") {
      console.log("[realtime] listening for scout_decisions INSERTs…");
    }
  });

await new Promise((r) => setTimeout(r, timeoutMs));
await supabase.removeChannel(channel);

console.log(`\n[realtime] done — ${received} decision(s) received via subscription`);
console.log(`[realtime] seen: ${seen.join(" | ") || "(none)"}`);
process.exit(received > 0 ? 0 : 1);
