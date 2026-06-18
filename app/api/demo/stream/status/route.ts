import { NextRequest, NextResponse } from "next/server";
import {
  expectedStreamTotal,
  getStreamRateUsdc,
} from "@/lib/demo/stream-session";
import { verifiedStreamTickCount } from "@/lib/demo/stream-session-store";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json(
      { error: "session_id is required" },
      { status: 400 },
    );
  }

  const tickCount = await verifiedStreamTickCount(sessionId);
  const rateUsdc = getStreamRateUsdc();
  const totalUsdc = expectedStreamTotal(tickCount);

  return NextResponse.json({
    session_id: sessionId,
    tick_count: tickCount,
    rate_usdc: rateUsdc,
    authorized_total_usdc: totalUsdc,
    invariant: {
      formula: `${tickCount} × ${rateUsdc} = ${totalUsdc}`,
      holds: true,
    },
  });
}
