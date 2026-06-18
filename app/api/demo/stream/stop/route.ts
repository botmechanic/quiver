import { NextRequest, NextResponse } from "next/server";
import { getClientIp } from "@/lib/demo/rate-limit";
import {
  expectedStreamTotal,
  getDemoStreamSession,
  getStreamRateUsdc,
  stopDemoStreamSession,
} from "@/lib/demo/stream-session";

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
  const totalUsdc = expectedStreamTotal(session.tickCount);

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
    tick_count: session.tickCount,
    rate_usdc: rateUsdc,
    authorized_total_usdc: totalUsdc,
    invariant: {
      formula: `${session.tickCount} × ${rateUsdc} = ${totalUsdc}`,
      holds: totalUsdc === expectedStreamTotal(session.tickCount),
    },
    label: labels[reason ?? "user"] ?? labels.user,
    fail_closed: reason === "tick_timeout" || reason === "tick_failed",
  });
}
