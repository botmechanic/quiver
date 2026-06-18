import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getClientIp } from "@/lib/demo/rate-limit";
import {
  expectedStreamTotal,
  getDemoStreamSession,
  getStreamRateUsdc,
  stopDemoStreamSession,
} from "@/lib/demo/stream-session";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function verifiedTickCount(sessionId: string): Promise<number> {
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

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  let sessionId: string | undefined;
  let reason: string | undefined;
  try {
    const body = await req.json();
    sessionId =
      typeof body?.session_id === "string" ? body.session_id : undefined;
    reason = typeof body?.reason === "string" ? body.reason : undefined;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  if (!sessionId) {
    return NextResponse.json(
      { error: "session_id is required" },
      { status: 400 },
    );
  }

  const existing = getDemoStreamSession(sessionId);
  if (!existing) {
    return NextResponse.json(
      { error: "Unknown stream session" },
      { status: 404 },
    );
  }

  if (existing.ip !== ip) {
    return NextResponse.json(
      { error: "Session IP mismatch" },
      { status: 403 },
    );
  }

  const session = stopDemoStreamSession(sessionId)!;
  const rateUsdc = getStreamRateUsdc();
  const dbTicks = await verifiedTickCount(sessionId);
  const tickCount = Math.max(session.tickCount, dbTicks);
  const totalUsdc = expectedStreamTotal(tickCount);

  const labels: Record<string, string> = {
    tick_timeout:
      "Stream closed — tick timed out. No further authorizations signed; you pay only for verified ticks.",
    tick_failed:
      "Stream closed — tick failed. No further authorizations signed; you pay only for verified ticks.",
    user: "Stream stopped — no further authorizations will be signed for this session.",
  };

  return NextResponse.json({
    demo: true,
    source: "stream",
    session_id: sessionId,
    stopped: true,
    reason: reason ?? "user",
    tick_count: tickCount,
    rate_usdc: rateUsdc,
    authorized_total_usdc: totalUsdc,
    invariant: {
      formula: `${tickCount} × ${rateUsdc} = ${totalUsdc}`,
      holds: totalUsdc === expectedStreamTotal(tickCount),
    },
    label: labels[reason ?? "user"] ?? labels.user,
    fail_closed: reason === "tick_timeout" || reason === "tick_failed",
  });
}
