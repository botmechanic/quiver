import { createClient } from "@supabase/supabase-js";
import type { DemoStreamSession } from "@/lib/demo/stream-session";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function rowToSession(row: {
  id: string;
  ip: string;
  started_at: string;
  tick_count: number;
  stopped: boolean;
}): DemoStreamSession {
  return {
    id: row.id,
    ip: row.ip,
    startedAt: new Date(row.started_at).getTime(),
    tickCount: row.tick_count,
    stopped: row.stopped,
  };
}

export async function persistStreamSession(
  session: DemoStreamSession,
): Promise<void> {
  const { error } = await supabase.from("demo_stream_sessions").upsert({
    id: session.id,
    ip: session.ip,
    started_at: new Date(session.startedAt).toISOString(),
    tick_count: session.tickCount,
    stopped: session.stopped,
  });
  if (error) {
    console.error("[demo/stream] persist session failed:", error.message);
  }
}

export async function loadStreamSession(
  sessionId: string,
): Promise<DemoStreamSession | null> {
  const { data, error } = await supabase
    .from("demo_stream_sessions")
    .select("id, ip, started_at, tick_count, stopped")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    console.error("[demo/stream] load session failed:", error.message);
    return null;
  }
  return data ? rowToSession(data) : null;
}

export async function verifiedStreamTickCount(
  sessionId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("stream_events")
    .select("tick_number")
    .eq("session_id", sessionId)
    .eq("status", "verified")
    .order("tick_number", { ascending: false })
    .limit(1);

  if (error || !data?.length) return 0;
  return data[0].tick_number;
}
