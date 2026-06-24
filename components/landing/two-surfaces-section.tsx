const SURFACES = [
  {
    title: "Agents",
    body: "Archer prices each signal and Scout decides per call whether it is worth buying, settling sub-cent over x402. This is the autonomous demo of the rail.",
  },
  {
    title: "Creators",
    body: "The same per-second core drives an Owncast sidecar: chat presence opens an x402 stream, USER_PARTED or a connected-client heartbeat closes it. Verified end-to-end against a local Owncast instance — one real settled tick.",
  },
] as const;

export function TwoSurfacesSection() {
  return (
    <section className="border-b border-border/25 py-20 sm:py-28 lg:py-32">
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary/70">
            One rail, two surfaces
          </p>
          <h2 className="font-display mt-6 text-4xl leading-[1.1] text-foreground sm:text-5xl">
            Agent demo today. Creator rail next.
          </h2>
          <p className="mt-8 max-w-[65ch] text-base leading-relaxed text-muted-foreground sm:text-[17px]">
            The primitive is the product: a second-by-second payment loop that
            can meter software calls or chat-active presence without a native
            rate primitive on Arc.
          </p>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-2 md:gap-6">
          {SURFACES.map((surface) => (
            <article
              key={surface.title}
              className="rounded-lg border border-border/30 bg-card/60 p-6 sm:p-7"
            >
              <h3 className="font-display text-2xl text-foreground sm:text-3xl">
                {surface.title}
              </h3>
              <p className="mt-5 text-base leading-relaxed text-muted-foreground">
                {surface.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
