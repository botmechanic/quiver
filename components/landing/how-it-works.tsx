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
    <section className="border-b border-border/40 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-primary">
            How it works
          </p>
          <h2 className="font-display mt-3 text-3xl text-accent-foreground sm:text-4xl">
            Three steps from signal to settlement
          </h2>
          <p className="mt-4 text-muted-foreground">
            Arrows are signals. Scout scouts for worthwhile ones. Quiver is
            where they live — priced, verified, and paid for in real testnet
            USDC.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map((item, index) => (
            <article
              key={item.step}
              className="group relative rounded-xl border border-border bg-card/50 p-6 transition-colors hover:border-primary/40"
            >
              {/* Arrow motif — drawn bow line */}
              <div
                className="absolute -top-px right-6 h-px w-16 bg-gradient-to-l from-primary/60 to-transparent"
                aria-hidden
              />
              {index < STEPS.length - 1 && (
                <div
                  className="absolute top-1/2 -right-3 hidden h-px w-6 bg-border md:block"
                  aria-hidden
                />
              )}
              <span className="font-mono text-xs text-primary">{item.step}</span>
              <h3 className="font-display mt-3 text-xl text-accent-foreground">
                {item.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {item.body}
              </p>
              <p className="mt-4 border-t border-border/60 pt-4 font-mono text-xs text-muted-foreground">
                {item.mechanic}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
