import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TickRhythm } from "@/components/landing/tick-rhythm";

export function StreamingSection() {
  return (
    <section className="border-b border-border/40 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-primary">
              Headline feature
            </p>
            <h2 className="font-display mt-3 text-3xl text-accent-foreground sm:text-4xl">
              Pay-per-second streaming over x402
            </h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              There is no native &ldquo;approve a rate&rdquo; primitive on Arc.
              Quiver composes streaming from discrete per-tick EIP-3009
              authorizations — one per second — that Circle Gateway verifies
              instantly and settles in batches.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="text-primary">→</span>
                Scout signs a fresh authorization every tick from one ephemeral
                wallet per session.
              </li>
              <li className="flex gap-2">
                <span className="text-primary">→</span>
                Tap-to-stop: no further auths are signed; you pay for exactly
                the ticks consumed.
              </li>
              <li className="flex gap-2">
                <span className="font-mono text-accent-foreground">
                  ticks × rate = total
                </span>
                <span>— the exact-cost invariant, always visible on the dashboard.</span>
              </li>
            </ul>
            <p className="mt-6 text-sm text-muted-foreground">
              Surface <strong className="font-medium text-foreground">authorized / verified</strong> volume,
              not settled — verification is sub-500ms; batch settlement lags.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/try">Try a discrete settlement</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/dashboard">Live stream meter</Link>
              </Button>
            </div>
          </div>

          <TickRhythm />
        </div>
      </div>
    </section>
  );
}
