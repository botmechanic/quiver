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
  try {
    const body = await req.json();
    sessionId =
      typeof body?.session_id === "string" ? body.session_id : undefined;
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

  return NextResponse.json({
    demo: true,
    source: "stream",
    session_id: sessionId,
    stopped: true,
    tick_count: session.tickCount,
    rate_usdc: rateUsdc,
    authorized_total_usdc: totalUsdc,
    invariant: {
      formula: `${session.tickCount} × ${rateUsdc} = ${totalUsdc}`,
      holds: totalUsdc === expectedStreamTotal(session.tickCount),
    },
    label:
      "Stream stopped — no further authorizations will be signed for this session.",
  });
}
