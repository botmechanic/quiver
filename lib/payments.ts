export type PaymentSource = "demo" | "scout" | "stream";

export function getPaymentSource(event: {
  raw: Record<string, unknown> | null;
}): PaymentSource {
  const source = event.raw?.source;
  if (source === "demo") return "demo";
  if (source === "stream") return "stream";
  return "scout";
}

export function formatUsdcTotal(events: { amount_usdc: string }[]): string {
  const total = events.reduce(
    (sum, event) => sum + parseFloat(event.amount_usdc || "0"),
    0,
  );
  return total.toFixed(6);
}
