/**
 * Verify prod Supabase stream schema (tables + indexes).
 * Usage: dotenv -e .env.local -- npx tsx scripts/verify-stream-schema.mts
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

async function main() {
  console.log("Supabase URL:", url);

  const { data: sessions, error: sessionsErr } = await supabase
    .from("demo_stream_sessions")
    .select("id")
    .limit(1);

  if (sessionsErr) {
    console.log("\n❌ demo_stream_sessions:", sessionsErr.message);
  } else {
    console.log("\n✅ demo_stream_sessions exists (sample query ok)");
  }

  const { data: events, error: eventsErr } = await supabase
    .from("stream_events")
    .select("session_id, tick_number")
    .order("created_at", { ascending: false })
    .limit(5);

  if (eventsErr) {
    console.log("❌ stream_events:", eventsErr.message);
  } else {
    console.log(`✅ stream_events exists (${events?.length ?? 0} recent rows fetched)`);
    if (events?.length) {
      console.log("   latest:", events);
    }
  }

  // Duplicate tick check (unique index proxy)
  const { data: dupes, error: dupeErr } = await supabase.rpc(
    "verify_stream_schema" as never,
    {} as never,
  );
  void dupes;
  void dupeErr;

  const { data: allRecent } = await supabase
    .from("stream_events")
    .select("session_id, tick_number")
    .order("created_at", { ascending: false })
    .limit(200);

  if (allRecent?.length) {
    const keys = new Map<string, number>();
    let duplicateRows = 0;
    for (const row of allRecent) {
      const k = `${row.session_id}:${row.tick_number}`;
      keys.set(k, (keys.get(k) ?? 0) + 1);
      if ((keys.get(k) ?? 0) > 1) duplicateRows++;
    }
    console.log(
      duplicateRows > 0
        ? `⚠️  ${duplicateRows} duplicate (session_id, tick_number) in last 200 rows — unique index may be missing`
        : "✅ no duplicate (session_id, tick_number) in last 200 rows",
    );
  }

  const { count: sessionCount } = await supabase
    .from("demo_stream_sessions")
    .select("*", { count: "exact", head: true });

  if (sessionCount !== null && !sessionsErr) {
    console.log(`   demo_stream_sessions row count: ${sessionCount}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
