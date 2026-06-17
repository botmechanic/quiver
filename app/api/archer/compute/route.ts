import { NextRequest, NextResponse } from "next/server";
import { createTraceEnvelope, generateArcherTrace } from "@/lib/archer/strategy";
import { withGateway } from "@/lib/x402";

const handler = async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}));
  const prompt =
    (body as { prompt?: string; text?: string }).prompt ??
    (body as { text?: string }).text ??
    "Run Archer's v0 deeper analysis.";
  const trace = generateArcherTrace("ARC-USDC");
  const words = prompt.split(/\s+/).filter(Boolean);

  return NextResponse.json({
    endpoint: "compute",
    price_usdc: "0.003",
    analysis: {
      symbol: trace.symbol,
      decision: trace.decision,
      confidence: trace.confidence,
      summary: `Archer reviewed ${words.length} input word(s) and currently returns a ${trace.decision} stance.`,
      input_word_count: words.length,
    },
    reasoning: createTraceEnvelope(trace),
  });
};

export const POST = withGateway(handler, "$0.003", "/api/archer/compute");
