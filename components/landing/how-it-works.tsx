const STEPS = [
  {
    step: "01",
    title: "Archer prices",
    body: "Each x402 call returns HTTP 402 with a price Archer set itself — pegged to compute cost and signal confidence.",
    mechanic: "Dynamic PAYMENT-REQUIRED header + reasoning trace hash",
  },
  {
    step: "02",
    title: "Scout decides",
    body: "Scout reads the quoted price and confidence, compares against its remaining budget, and buys or declines with a logged reason.",
    mechanic: "Two-gate policy: confidence ≥ 0.45, price ≤ budget × confidence",
  },
  {
    step: "03",
    title: "Gateway settles",
    body: "Every accepted call signs an EIP-3009 authorization; Circle Gateway verifies in sub-500ms and batches settlement on Arc testnet.",
    mechanic: "x402 → TransferWithAuthorization → batched USDC",
  },
] as const;

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="border-b border-border/25 py-20 sm:py-28 lg:py-32"
    >
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <div className="max-w-2xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-primary/70">
            How it works
          </p>
          <h2 className="font-display mt-4 text-3xl text-foreground sm:text-4xl">
            Three steps from signal to settlement
          </h2>
          <p className="mt-5 leading-relaxed text-muted-foreground">
            Arrows are signals. Scout scouts for worthwhile ones. Quiver is
            where they live — priced, verified, and paid for in real testnet
            USDC.
          </p>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-3 md:gap-6">
          {STEPS.map((item) => (
            <article
              key={item.step}
              className="rounded-lg border border-border/30 bg-card/60 p-6"
            >
              <span className="font-mono text-xs text-muted-foreground">
                {item.step}
              </span>
              <h3 className="font-display mt-3 text-xl text-foreground">
                {item.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {item.body}
              </p>
              <p className="mt-5 border-t border-border/25 pt-4 font-mono text-xs text-muted-foreground">
                {item.mechanic}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
