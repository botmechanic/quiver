import Link from "next/link";
import { Button } from "@/components/ui/button";
import { QuiverLogo } from "@/components/landing/quiver-logo";
import { HeroCanvasBackground } from "@/components/landing/hero-canvas-background";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden border-b border-border/40">
      <HeroCanvasBackground />

      <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-16">
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-primary">
            Quiver · Nanopayments on Arc
          </p>
          <h1 className="font-display mt-5 text-4xl leading-[1.1] text-accent-foreground sm:text-5xl lg:text-[3.25rem]">
            Two agents. Real money. A fraction of a cent at a time.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Archer sells signals over x402 and prices every request itself.
            Scout reads the price and the confidence, then decides whether to
            buy. The headline: a live stream that bills per second and stops
            the instant you say stop.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="font-semibold">
              <Link href="/try">Trigger a real settlement</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/dashboard">Watch money move</Link>
            </Button>
            <Link
              href="/login"
              className="px-2 text-sm text-muted-foreground transition-colors hover:text-primary"
            >
              Operator sign-in
            </Link>
          </div>
        </div>

        <div className="hidden lg:block">
          <QuiverLogo variant="mark" className="w-28 opacity-90" />
        </div>
      </div>
    </section>
  );
}
