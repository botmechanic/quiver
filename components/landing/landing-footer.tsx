import Link from "next/link";
import { TryQuiverPanel } from "@/components/try-quiver-panel";

export function TrySection() {
  return (
    <section className="border-b border-border/25 py-20 sm:py-28 lg:py-32">
      <div className="mx-auto max-w-xl px-5 sm:px-8">
        <TryQuiverPanel variant="landing" />
      </div>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer className="py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <div className="flex flex-col gap-8 border-t border-border/25 pt-10 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-md space-y-3 text-xs leading-relaxed text-muted-foreground">
            <p>
              Quiver runs on Arc testnet. USDC shown is testnet value only —
              not real money.
            </p>
            <p>
              Signals and reasoning traces are for educational demonstration.
              Not investment advice.
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <a
              href="https://github.com/botmechanic/quiver"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              GitHub
            </a>
            <Link
              href="/try"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              /try
            </Link>
            <Link
              href="/dashboard"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Dashboard
            </Link>
            <Link
              href="/login"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign in
            </Link>
          </nav>
        </div>
        <p className="mt-10 text-center text-[11px] uppercase tracking-[0.2em] text-muted-foreground/50">
          Lepton Agents Hackathon · Circle Gateway · x402
        </p>
      </div>
    </footer>
  );
}
