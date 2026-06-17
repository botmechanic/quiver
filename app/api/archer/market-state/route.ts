import { NextRequest, NextResponse } from "next/server";
import { createTraceEnvelope, generateArcherTrace } from "@/lib/archer/strategy";
import { withGateway } from "@/lib/x402";

const handler = async (_req: NextRequest) => {
  const trace = generateArcherTrace("ARC-USDC");
  const momentum = trace.factors.find((factor) => factor.name === "momentum");
  const liquidity = trace.factors.find((factor) => factor.name === "liquidity");
  const volatility = trace.factors.find((factor) => factor.name === "volatility");

  return NextResponse.json({
    endpoint: "market-state",
    price_usdc: "0.0001",
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
  "$0.0001",
  "/api/archer/market-state",
);
