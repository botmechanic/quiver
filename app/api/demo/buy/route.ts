import { NextRequest, NextResponse } from "next/server";
import {
  executeDemoBuy,
  resolveBaseUrl,
} from "@/lib/demo/gateway-buyer";
import { checkDemoRateLimit, getClientIp } from "@/lib/demo/rate-limit";

const ALLOWED_ENDPOINTS = {
  signal: { path: "/api/archer/signal", method: "GET" as const },
  "market-state": {
    path: "/api/archer/market-state",
    method: "GET" as const,
  },
  compute: {
    path: "/api/archer/compute",
    method: "POST" as const,
    body: { prompt: "Visitor demo — Archer's deeper ARC-USDC read." },
  },
};

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rateLimit = checkDemoRateLimit(ip);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: "Demo rate limit exceeded",
        message: `Try again in ${rateLimit.retryAfterSeconds}s — demo buys are funder-funded and rate-limited.`,
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

  let endpointKey = "signal";
  try {
    const body = await req.json().catch(() => ({}));
    if (
      typeof body === "object" &&
      body !== null &&
      typeof (body as { endpoint?: string }).endpoint === "string"
    ) {
      endpointKey = (body as { endpoint: string }).endpoint;
    }
  } catch {
    // default signal
  }

  const target =
    ALLOWED_ENDPOINTS[endpointKey as keyof typeof ALLOWED_ENDPOINTS] ??
    ALLOWED_ENDPOINTS.signal;

  const baseUrl = resolveBaseUrl(req);
  const targetUrl = `${baseUrl}${target.path}`;

  try {
    const started = Date.now();
    const payment = await executeDemoBuy(targetUrl, {
      method: target.method,
      body: "body" in target ? target.body : undefined,
    });

    return NextResponse.json({
      demo: true,
      source: "demo",
      label:
        "Demo-funded buy — a real x402 settlement from Quiver's funder wallet, not a distinct visitor payer.",
      endpoint: target.path,
      settlement: {
        amount_usdc: payment.amount,
        transaction: payment.transaction,
        payer: payment.payer,
        elapsed_ms: payment.elapsedMs,
        total_elapsed_ms: Date.now() - started,
      },
      archer: payment.data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[demo/buy] Failed:", message);
    return NextResponse.json(
      {
        error: "Demo buy failed",
        message,
      },
      { status: 500 },
    );
  }
}
