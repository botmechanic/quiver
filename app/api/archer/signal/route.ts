import { NextRequest, NextResponse } from "next/server";
import { createTraceEnvelope, generateArcherTrace } from "@/lib/archer/strategy";
import { withGateway } from "@/lib/x402";

const handler = async (_req: NextRequest) => {
  const trace = generateArcherTrace("ARC-USDC");

  return NextResponse.json({
    endpoint: "signal",
    price_usdc: "0.001",
    signal: {
      symbol: trace.symbol,
      decision: trace.decision,
      confidence: trace.confidence,
    },
    reasoning: createTraceEnvelope(trace),
  });
};

export const GET = withGateway(handler, "$0.001", "/api/archer/signal");
