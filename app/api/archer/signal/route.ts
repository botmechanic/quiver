import { NextRequest, NextResponse } from "next/server";
import { logPriceQuote, quoteSignal } from "@/lib/archer/pricing";
import {
  createTraceEnvelope,
  generateArcherTrace,
  type ArcherTrace,
} from "@/lib/archer/strategy";
import { withGateway } from "@/lib/x402";

interface SignalContext {
  trace: ArcherTrace;
  quote: ReturnType<typeof quoteSignal>;
}

const handler = async (_req: NextRequest, ctx: SignalContext) => {
  const { trace, quote } = ctx;

  return NextResponse.json({
    endpoint: "signal",
    price_usdc: quote.priceUsdc,
    price_reason: quote.reason,
    signal: {
      symbol: trace.symbol,
      decision: trace.decision,
      confidence: trace.confidence,
    },
    reasoning: createTraceEnvelope(trace),
  });
};

export const GET = withGateway(
  handler,
  async () => {
    const trace = generateArcherTrace("ARC-USDC");
    const quote = quoteSignal(trace);
    logPriceQuote(quote);
    return { quote, ctx: { trace, quote } };
  },
  "/api/archer/signal",
);
