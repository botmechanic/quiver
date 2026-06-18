import { NextRequest, NextResponse } from "next/server";
import {
  executeDemoStreamTick,
  resolveBaseUrl,
} from "@/lib/demo/stream-buyer";
import { getClientIp } from "@/lib/demo/rate-limit";
import {
  advanceStreamTick,
  expectedStreamTotal,
  getDemoStreamSession,
  validateStreamTick,
} from "@/lib/demo/stream-session";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  let sessionId: string | undefined;
  let tick: number | undefined;

  try {
    const body = await req.json();
    sessionId =
      typeof body?.session_id === "string" ? body.session_id : undefined;
    tick = typeof body?.tick === "number" ? body.tick : parseInt(body?.tick, 10);
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  if (!sessionId || !Number.isFinite(tick) || tick! < 1) {
    return NextResponse.json(
      { error: "session_id and tick are required" },
      { status: 400 },
    );
  }

  const session = getDemoStreamSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: "Unknown stream session" },
      { status: 404 },
    );
  }

  const validation = validateStreamTick(session, ip, tick!);
  if (!validation.ok) {
    return NextResponse.json(
      { error: "Stream tick rejected", message: validation.message },
      { status: 400 },
    );
  }

  const baseUrl = resolveBaseUrl(req);
  const targetUrl = `${baseUrl}/api/archer/stream`;

  try {
    const started = Date.now();
    const payment = await executeDemoStreamTick(sessionId, tick!, targetUrl);
    advanceStreamTick(session);

    const cumulativeUsdc = expectedStreamTotal(session.tickCount);

    return NextResponse.json({
      demo: true,
      source: "stream",
      session_id: sessionId,
      tick: session.tickCount,
      settlement: {
        amount_usdc: payment.amount,
        cumulative_usdc: cumulativeUsdc,
        transaction: payment.transaction,
        payer: payment.payer,
        elapsed_ms: payment.elapsedMs,
        total_elapsed_ms: Date.now() - started,
      },
      archer: payment.data,
      invariant: {
        ticks: session.tickCount,
        rate_usdc: "0.000100",
        expected_total_usdc: cumulativeUsdc,
        holds: payment.amount === "0.0001",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[demo/stream/tick] Failed:", message);
    session.stopped = true;
    return NextResponse.json(
      { error: "Stream tick failed", message },
      { status: 500 },
    );
  }
}
