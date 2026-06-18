import { NextRequest, NextResponse } from "next/server";
import {
  executeDemoStreamTick,
  resolveBaseUrl,
} from "@/lib/demo/stream-buyer";
import { getClientIp } from "@/lib/demo/rate-limit";
import {
  advanceStreamTick,
  expectedStreamTotal,
  failDemoStreamSession,
  refreshDemoStreamSessionFromDb,
  resolveDemoStreamSession,
  validateStreamTick,
} from "@/lib/demo/stream-session";
import {
  alignSessionTickCountWithEvents,
  verifiedStreamTickCount,
} from "@/lib/demo/stream-session-store";
import {
  STREAM_TICK_SERVER_TIMEOUT_MS,
  tickTimeoutMs,
} from "@/lib/stream/constants";
import { withServerTimeout } from "@/lib/stream/fetch-with-timeout";

export const maxDuration = 60;

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

  const session = await resolveDemoStreamSession(sessionId);
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
    const payment = await withServerTimeout(
      executeDemoStreamTick(sessionId, tick!, targetUrl),
      Math.max(STREAM_TICK_SERVER_TIMEOUT_MS, tickTimeoutMs(tick!) + 5000),
      "Stream tick",
    );

    const fresh = await refreshDemoStreamSessionFromDb(sessionId);
    const verifiedTicks = await verifiedStreamTickCount(sessionId);

    if (!fresh) {
      return NextResponse.json(
        {
          error: "Stream session closed",
          message:
            "Tick verified but session row is missing — no further ticks will be accepted.",
          session_row_missing: verifiedTicks > 0,
          verified_ticks: verifiedTicks,
          authorized_total_usdc: expectedStreamTotal(verifiedTicks),
          settlement: {
            amount_usdc: payment.amount,
            payer: payment.payer,
            elapsed_ms: payment.elapsedMs,
          },
        },
        { status: 409 },
      );
    }

    if (fresh.stopped) {
      const alignedTicks = await alignSessionTickCountWithEvents(sessionId);
      return NextResponse.json(
        {
          error: "Stream session closed",
          message:
            "Tick completed after the session was stopped — no further ticks will be accepted.",
          verified_ticks: alignedTicks,
          authorized_total_usdc: expectedStreamTotal(alignedTicks),
          settlement: {
            amount_usdc: payment.amount,
            payer: payment.payer,
            elapsed_ms: payment.elapsedMs,
          },
        },
        { status: 409 },
      );
    }

    await advanceStreamTick(fresh);

    const cumulativeUsdc = expectedStreamTotal(fresh.tickCount);

    return NextResponse.json({
      demo: true,
      source: "stream",
      session_id: sessionId,
      tick: fresh.tickCount,
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
        ticks: fresh.tickCount,
        rate_usdc: "0.000100",
        expected_total_usdc: cumulativeUsdc,
        holds: payment.amount === "0.0001",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[demo/stream/tick] Failed:", message);
    await failDemoStreamSession(sessionId, message);
    const verifiedTicks = await verifiedStreamTickCount(sessionId);
    const isTimeout = message.includes("timed out");
    return NextResponse.json(
      {
        error: isTimeout ? "Stream tick timed out" : "Stream tick failed",
        message,
        fail_closed: true,
        verified_ticks: verifiedTicks,
        authorized_total_usdc: expectedStreamTotal(verifiedTicks),
      },
      { status: isTimeout ? 504 : 500 },
    );
  }
}
