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
  let failed = false;

  console.log("Supabase URL:", url);

  const { data: sessions, error: sessionsErr } = await supabase
    .from("demo_stream_sessions")
    .select("id")
    .limit(1);

  if (sessionsErr) {
    console.log("\n❌ demo_stream_sessions:", sessionsErr.message);
    failed = true;
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
    failed = true;
  } else {
    console.log(`✅ stream_events exists (${events?.length ?? 0} recent rows fetched)`);
    if (events?.length) {
      console.log("   latest:", events);
    }
  }

  // Duplicate tick check (unique index proxy)
  const { data: schemaCheck, error: schemaCheckErr } = await supabase.rpc(
    "verify_stream_schema" as never,
    {} as never,
  );
  if (schemaCheckErr) {
    console.log(
      "ℹ️  verify_stream_schema RPC unavailable:",
      schemaCheckErr.message,
    );
  } else {
    console.log("✅ verify_stream_schema RPC returned:", schemaCheck);
  }

  const { data: allRecent, error: recentErr } = await supabase
    .from("stream_events")
    .select("session_id, tick_number")
    .order("created_at", { ascending: false })
    .limit(200);

  if (recentErr) {
    console.log("❌ recent stream_events duplicate check:", recentErr.message);
    failed = true;
  } else if (allRecent?.length) {
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
    if (duplicateRows > 0) failed = true;
  } else {
    console.log("✅ no recent stream_events rows to duplicate-check");
  }

  const { count: sessionCount, error: sessionCountErr } = await supabase
    .from("demo_stream_sessions")
    .select("*", { count: "exact", head: true });

  if (sessionCountErr) {
    console.log("❌ demo_stream_sessions row count:", sessionCountErr.message);
    failed = true;
  } else if (sessionCount !== null) {
    console.log(`   demo_stream_sessions row count: ${sessionCount}`);
  }

  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
