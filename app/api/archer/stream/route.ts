import { NextRequest, NextResponse } from "next/server";
import { logPriceQuote, quoteStream } from "@/lib/archer/pricing";
import {
  createTraceEnvelope,
  generateStreamTrace,
  type ArcherTrace,
} from "@/lib/archer/strategy";
import { withGateway } from "@/lib/x402";

interface StreamContext {
  trace: ArcherTrace;
  quote: ReturnType<typeof quoteStream>;
  tick: number;
}

const handler = async (req: NextRequest, ctx: StreamContext) => {
  const { trace, quote, tick } = ctx;
  const sessionId = req.headers.get("x-quiver-stream-session");

  return NextResponse.json({
    endpoint: "stream",
    session_id: sessionId,
    tick,
    price_usdc: quote.priceUsdc,
    price_reason: quote.reason,
    feed: {
      symbol: trace.symbol,
      decision: trace.decision,
      confidence: trace.confidence,
      generated_at: trace.generated_at,
    },
    reasoning: createTraceEnvelope(trace),
  });
};

export const GET = withGateway(
  handler,
  async (req) => {
    const tickRaw = req.headers.get("x-quiver-stream-tick");
    const tick = tickRaw ? Math.max(1, parseInt(tickRaw, 10)) : 1;
    const trace = generateStreamTrace(tick);
    const quote = quoteStream(trace);
    logPriceQuote(quote);
    return { quote, ctx: { trace, quote, tick } };
  },
  "/api/archer/stream",
);
