import { NextRequest, NextResponse } from "next/server";
import { getClientIp } from "@/lib/demo/rate-limit";
import {
  expectedStreamTotal,
  getStreamRateUsdc,
  resolveDemoStreamSession,
  stopDemoStreamSession,
} from "@/lib/demo/stream-session";
import { verifiedStreamTickCount } from "@/lib/demo/stream-session-store";
import { streamCloseLabel } from "@/lib/stream/constants";

export const maxDuration = 60;

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

  const existing = await resolveDemoStreamSession(sessionId);
  if (existing && existing.ip !== ip) {
    return NextResponse.json(
      { error: "Session IP mismatch" },
      { status: 403 },
    );
  }

  const session = existing ? await stopDemoStreamSession(sessionId) : null;
  const rateUsdc = getStreamRateUsdc();
  const dbTicks = await verifiedStreamTickCount(sessionId);
  const tickCount = dbTicks;
  const totalUsdc = expectedStreamTotal(tickCount);
  const closeReason = (reason ?? "user") as "user" | "tick_timeout" | "tick_failed";
  const sessionRowMissing = !existing && dbTicks > 0;
  const sessionTickDrift =
    existing !== null && session !== null && session.tickCount !== dbTicks;

  const labels: Record<string, string> = {
    tick_timeout: streamCloseLabel("tick_timeout", tickCount),
    tick_failed: streamCloseLabel("tick_failed", tickCount),
    user: streamCloseLabel("user", tickCount),
  };

  return NextResponse.json({
    demo: true,
    source: "stream",
    session_id: sessionId,
    stopped: true,
    reason: closeReason,
    tick_count: tickCount,
    rate_usdc: rateUsdc,
    authorized_total_usdc: totalUsdc,
    invariant: {
      formula: `${tickCount} × ${rateUsdc} = ${totalUsdc}`,
      holds: totalUsdc === expectedStreamTotal(tickCount),
    },
    label: labels[closeReason] ?? labels.user,
    fail_closed: closeReason === "tick_timeout" || closeReason === "tick_failed",
    session_row_missing: sessionRowMissing,
    session_tick_drift: sessionTickDrift,
  });
}
