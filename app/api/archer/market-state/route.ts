import { NextRequest, NextResponse } from "next/server";
import { logPriceQuote, quoteMarketState } from "@/lib/archer/pricing";
import {
  createTraceEnvelope,
  generateArcherTrace,
  type ArcherTrace,
} from "@/lib/archer/strategy";
import { withGateway } from "@/lib/x402";

interface MarketStateContext {
  trace: ArcherTrace;
  quote: ReturnType<typeof quoteMarketState>;
}

const handler = async (_req: NextRequest, ctx: MarketStateContext) => {
  const { trace, quote } = ctx;
  const momentum = trace.factors.find((factor) => factor.name === "momentum");
  const liquidity = trace.factors.find((factor) => factor.name === "liquidity");
  const volatility = trace.factors.find(
    (factor) => factor.name === "volatility",
  );

  return NextResponse.json({
    endpoint: "market-state",
    price_usdc: quote.priceUsdc,
    price_reason: quote.reason,
    market_state: {
      symbol: trace.symbol,
      momentum: momentum?.value,
      liquidity: liquidity?.value,
      volatility: volatility?.value,
      stance: trace.decision,
      confidence: trace.confidence,
    },
    reasoning: createTraceEnvelope(trace),
  });
};

export const GET = withGateway(
  handler,
  async () => {
    const trace = generateArcherTrace("ARC-USDC");
    const quote = quoteMarketState(trace);
    logPriceQuote(quote);
    return { quote, ctx: { trace, quote } };
  },
  "/api/archer/market-state",
);
