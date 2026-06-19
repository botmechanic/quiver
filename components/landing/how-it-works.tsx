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
    mechanic: "Two-gate policy: confidence ≥ 0.45, price ≤ confidence × remaining budget",
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
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary/70">
            How it works
          </p>
          <h2 className="font-display mt-6 text-4xl leading-[1.1] text-foreground sm:text-5xl">
            Three steps from signal to settlement
          </h2>
          <p className="mt-8 max-w-[65ch] text-base leading-relaxed text-muted-foreground sm:text-[17px]">
            Arrows are signals. Scout scouts for worthwhile ones. Quiver is
            where they live — priced, verified, and paid for in real testnet
            USDC.
          </p>
        </div>

        <div className="mt-16 grid gap-5 md:grid-cols-3 md:gap-6">
          {STEPS.map((item) => (
            <article
              key={item.step}
              className="rounded-lg border border-border/30 bg-card/60 p-6 sm:p-7"
            >
              <span className="font-mono text-xs text-muted-foreground">
                {item.step}
              </span>
              <h3 className="font-display mt-4 text-xl text-foreground sm:text-2xl">
                {item.title}
              </h3>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                {item.body}
              </p>
              <p className="mt-6 border-t border-border/25 pt-4 font-mono text-xs leading-relaxed text-muted-foreground">
                {item.mechanic}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
