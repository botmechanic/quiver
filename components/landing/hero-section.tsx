import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HeroCanvasBackground } from "@/components/landing/hero-canvas-background";

export function HeroSection() {
  return (
    <section className="relative border-b border-border/25">
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(260px,44%)] lg:gap-14">
          <div className="relative z-10 py-20 sm:py-28 lg:py-36">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-primary/70">
              Nanopayments on Arc
            </p>
            <h1 className="font-display mt-6 max-w-xl text-4xl leading-[1.08] text-foreground sm:text-5xl lg:text-[3.25rem]">
              Two agents. Real money. A fraction of a cent at a time.
            </h1>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-[17px] sm:leading-7">
              Archer sells signals over x402 and prices every request itself.
              Scout reads the price and the confidence, then decides whether to
              buy. The headline: a live stream that bills per second and stops
              the instant you say stop.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Button
                asChild
                size="lg"
                className="px-7 font-semibold transition-transform hover:brightness-105 active:translate-y-px"
              >
                <Link href="/try">Trigger a real settlement</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="border-border/40 px-7 text-foreground transition-transform hover:border-border/60 hover:bg-transparent hover:text-primary active:translate-y-px"
              >
                <Link href="/dashboard">Watch money move</Link>
              </Button>
            </div>
            <p className="mt-8">
              <Link
                href="/login"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Operator sign-in
              </Link>
            </p>
          </div>

          <div className="relative hidden min-h-[420px] lg:block lg:min-h-[520px]">
            <HeroCanvasBackground className="absolute inset-0 rounded-sm" />
          </div>
        </div>

        <div className="relative -mt-4 mb-16 h-44 overflow-hidden lg:hidden">
          <HeroCanvasBackground className="absolute inset-0 opacity-80" />
        </div>
      </div>
    </section>
  );
}
