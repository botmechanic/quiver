import Link from "next/link";
import { TryQuiverPanel } from "@/components/try-quiver-panel";
import { QuiverLogo } from "@/components/landing/quiver-logo";

export default function TryPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 px-6 py-12">
      <div>
        <QuiverLogo variant="wordmark" className="text-sm tracking-[0.25em]" />
        <h1 className="font-display mt-4 text-3xl text-accent-foreground">
          Try the payment loop
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          One click, no wallet. A demo-funded real x402 settlement on Arc
          testnet.
        </p>
      </div>

      <TryQuiverPanel />

      <p className="text-center text-xs text-muted-foreground">
        <Link href="/" className="text-primary hover:underline">
          Landing
        </Link>
        {" · "}
        <Link href="/login" className="text-primary hover:underline">
          Operator sign-in
        </Link>
        {" · "}
        <Link href="/dashboard" className="text-primary hover:underline">
          Dashboard
        </Link>
      </p>
    </main>
  );
}
