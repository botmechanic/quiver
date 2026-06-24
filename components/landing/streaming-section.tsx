import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TickRhythm } from "@/components/landing/tick-rhythm";

export function StreamingSection() {
  return (
    <section
      id="streaming"
      className="border-b border-border/25 py-20 sm:py-28 lg:py-32"
    >
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <div className="grid gap-14 lg:grid-cols-2 lg:items-center lg:gap-16">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary/70">
              Headline feature
            </p>
            <h2 className="font-display mt-6 text-4xl leading-[1.1] text-foreground sm:text-5xl">
              Pay-per-second streaming over x402
            </h2>
            <p className="mt-8 max-w-[65ch] text-base leading-relaxed text-muted-foreground sm:text-[17px]">
              You pay for the seconds you watch. There is no native
              &ldquo;approve a rate&rdquo; primitive on Arc, so Quiver composes
              streaming from discrete per-tick EIP-3009 authorizations that
              Circle Gateway verifies quickly and settles in batches.
            </p>
            <ul className="mt-8 max-w-[65ch] space-y-4 text-base leading-relaxed text-muted-foreground">
              <li>
                Scout signs a fresh authorization every second from one
                ephemeral wallet per session.
              </li>
              <li>
                Tap stop, and signing halts the same instant. No signature
                means no next-second payment.
              </li>
              <li>
                <span className="font-mono text-foreground">
                  ticks × rate = total
                </span>{" "}
                — the dashboard reconciles to verified stream rows, never a
                cached guess.
              </li>
            </ul>
            <p className="mt-8 max-w-[65ch] text-base leading-relaxed text-muted-foreground">
              Surface authorized / verified volume, not settled — verification
              feels live while batch settlement can lag.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Button
                asChild
                className="px-6 font-semibold transition-transform hover:brightness-105 active:translate-y-px"
              >
                <Link href="/try">Try a discrete settlement</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="border-border/40 px-6 text-foreground hover:border-border/60 hover:bg-transparent hover:text-primary"
              >
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
