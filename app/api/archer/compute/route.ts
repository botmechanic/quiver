import { NextRequest, NextResponse } from "next/server";
import { logPriceQuote, quoteCompute } from "@/lib/archer/pricing";
import {
  createTraceEnvelope,
  generateArcherTrace,
  type ArcherTrace,
} from "@/lib/archer/strategy";
import { withGateway } from "@/lib/x402";

interface ComputeContext {
  trace: ArcherTrace;
  quote: ReturnType<typeof quoteCompute>;
  prompt: string;
}

function readPrompt(body: unknown) {
  const record = (body ?? {}) as { prompt?: string; text?: string };
  return record.prompt ?? record.text ?? "Run Archer's v0 deeper analysis.";
}

const handler = async (_req: NextRequest, ctx: ComputeContext) => {
  const { trace, quote, prompt } = ctx;
  const words = prompt.split(/\s+/).filter(Boolean);

  return NextResponse.json({
    endpoint: "compute",
    price_usdc: quote.priceUsdc,
    price_reason: quote.reason,
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

export const POST = withGateway(
  handler,
  async (req) => {
    const body = await req.json().catch(() => ({}));
    const prompt = readPrompt(body);
    const trace = generateArcherTrace("ARC-USDC");
    const quote = quoteCompute(trace, prompt);
    logPriceQuote(quote);
    return { quote, ctx: { trace, quote, prompt } };
  },
  "/api/archer/compute",
);
