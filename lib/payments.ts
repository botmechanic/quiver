export type PaymentSource = "demo" | "scout";

export function getPaymentSource(event: {
  raw: Record<string, unknown> | null;
}): PaymentSource {
  return event.raw?.source === "demo" ? "demo" : "scout";
}

export function formatUsdcTotal(events: { amount_usdc: string }[]): string {
  const total = events.reduce(
    (sum, event) => sum + parseFloat(event.amount_usdc || "0"),
    0,
  );
  return total.toFixed(6);
}
