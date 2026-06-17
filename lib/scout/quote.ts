export interface Archer402Quote {
  endpoint: string;
  priceUsdc: number;
  confidence: number;
  priceReason: string;
}

interface PaymentRequiredPayload {
  resource?: { url?: string };
  accepts?: Array<{ amount?: string }>;
  extensions?: {
    quiver?: {
      price_usdc?: string;
      price_reason?: string;
      confidence?: number;
    };
  };
}

export function parsePaymentRequiredHeader(
  header: string,
): Archer402Quote | null {
  try {
    const payload = JSON.parse(
      Buffer.from(header, "base64").toString("utf-8"),
    ) as PaymentRequiredPayload;

    const endpoint = payload.resource?.url ?? "unknown";
    const quiver = payload.extensions?.quiver;
    const atomicAmount = payload.accepts?.[0]?.amount;
    const fallbackPrice =
      atomicAmount !== undefined ? Number(atomicAmount) / 1e6 : 0;

    const priceUsdc = parseFloat(quiver?.price_usdc ?? String(fallbackPrice));
    const confidence = quiver?.confidence ?? 0;

    return {
      endpoint,
      priceUsdc,
      confidence,
      priceReason: quiver?.price_reason ?? "",
    };
  } catch {
    return null;
  }
}

export async function fetchArcherQuote(
  url: string,
  options: {
    method: "GET" | "POST";
    body?: unknown;
  },
): Promise<Archer402Quote> {
  const serializedBody =
    options.body !== undefined ? JSON.stringify(options.body) : undefined;

  const response = await fetch(url, {
    method: options.method,
    headers: { "Content-Type": "application/json" },
    body: serializedBody,
  });

  if (response.status !== 402) {
    throw new Error(
      `Expected 402 quote from ${url}, got ${response.status}`,
    );
  }

  const header = response.headers.get("PAYMENT-REQUIRED");
  if (!header) {
    throw new Error(`Missing PAYMENT-REQUIRED header from ${url}`);
  }

  const quote = parsePaymentRequiredHeader(header);
  if (!quote) {
    throw new Error(`Could not parse PAYMENT-REQUIRED from ${url}`);
  }

  return quote;
}
