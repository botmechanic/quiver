import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HeroCanvasBackground } from "@/components/landing/hero-canvas-background";

export function HeroSection() {
  return (
    <section className="relative border-b border-border/25">
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(260px,44%)] lg:gap-14">
          <div className="relative z-10 py-28 sm:py-32 lg:py-40">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary/70">
              Per-second payments on Arc
            </p>
            <h1 className="font-display mt-6 max-w-2xl text-5xl leading-[1.05] text-foreground sm:text-6xl lg:text-[4.5rem]">
              Stream money by the second.
            </h1>
            <p className="mt-8 max-w-[34ch] text-lg leading-8 text-muted-foreground sm:max-w-xl sm:text-xl">
              Quiver is a pay-per-second settlement rail built on x402 and
              Circle Gateway. It bills for exactly the seconds consumed and
              stops the instant you do, composed from per-tick authorizations
              that Gateway batches onchain.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Button
                asChild
                size="lg"
                className="px-7 font-semibold transition-transform hover:brightness-105 active:translate-y-px"
              >
                <Link href="/try">See it settle</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="border-border/40 px-7 text-foreground transition-transform hover:border-border/60 hover:bg-transparent hover:text-primary active:translate-y-px"
              >
                <Link href="/dashboard">Watch the live meter</Link>
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
