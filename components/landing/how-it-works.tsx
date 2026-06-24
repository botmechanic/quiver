const STEPS = [
  {
    step: "01",
    title: "Quote the usage",
    body: "Each billable moment becomes an x402 quote: one signal, one stream tick, or one future chat-active creator interval.",
    mechanic: "HTTP 402 + dynamic PAYMENT-REQUIRED header on Arc",
  },
  {
    step: "02",
    title: "Authorize the second",
    body: "The buyer signs a fresh EIP-3009 authorization for the current second. Stop the stream, and no new authorization is signed.",
    mechanic: "One session wallet + one authorization per tick",
  },
  {
    step: "03",
    title: "Gateway settles",
    body: "Circle Gateway verifies each accepted authorization quickly and batches settlement on Arc testnet while Quiver reconciles against verified rows.",
    mechanic: "x402 -> TransferWithAuthorization -> batched USDC",
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
            Three steps from seconds to settlement
          </h2>
          <p className="mt-8 max-w-[65ch] text-base leading-relaxed text-muted-foreground sm:text-[17px]">
            This is where the protocol shows up: x402 quotes, EIP-3009
            authorizations, Circle Gateway batching, and Arc testnet settlement.
            The visitor sees seconds; the rail handles the payment machinery.
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
