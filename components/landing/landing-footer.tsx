import Link from "next/link";
import { TryQuiverPanel } from "@/components/try-quiver-panel";

export function TrySection() {
  return (
    <section className="border-b border-border/40 py-16 sm:py-24">
      <div className="mx-auto max-w-2xl px-4 sm:px-6">
        <TryQuiverPanel variant="landing" />
      </div>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer className="py-12 sm:py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col gap-6 border-t border-border/60 pt-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-md space-y-3 text-xs leading-relaxed text-muted-foreground">
            <p>
              Quiver runs on{" "}
              <strong className="font-medium text-foreground">Arc testnet</strong>
              . USDC shown is testnet value only — not real money.
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
              className="text-primary hover:underline"
            >
              GitHub
            </a>
            <Link href="/try" className="text-primary hover:underline">
              /try
            </Link>
            <Link href="/dashboard" className="text-primary hover:underline">
              Dashboard
            </Link>
            <Link href="/login" className="text-muted-foreground hover:text-primary">
              Sign in
            </Link>
          </nav>
        </div>
        <p className="mt-8 text-center text-[10px] uppercase tracking-widest text-muted-foreground/60">
          Quiver · Lepton Agents Hackathon · Circle Gateway · x402
        </p>
      </div>
    </footer>
  );
}
