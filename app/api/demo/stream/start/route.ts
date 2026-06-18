import { NextRequest, NextResponse } from "next/server";
import { checkDemoRateLimit, getClientIp } from "@/lib/demo/rate-limit";
import {
  createDemoStreamSession,
  getStreamRateUsdc,
} from "@/lib/demo/stream-session";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rateLimit = checkDemoRateLimit(ip);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: "Demo rate limit exceeded",
        message: `Try again in ${rateLimit.retryAfterSeconds}s before starting another stream.`,
        retry_after_seconds: rateLimit.retryAfterSeconds,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds ?? 30),
        },
      },
    );
  }

  const session = await createDemoStreamSession(ip);

  return NextResponse.json({
    demo: true,
    source: "stream",
    label:
      "Demo-funded stream — authorized per-second ticks from Quiver's funder wallet. Volume shown is verified/authorized, not settled.",
    session_id: session.id,
    rate_usdc: getStreamRateUsdc(),
    max_ticks: Number(process.env.STREAM_MAX_TICKS ?? "120"),
  });
}
