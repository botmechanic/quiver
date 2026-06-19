import Link from "next/link";
import { TryQuiverPanel } from "@/components/try-quiver-panel";
import { QuiverLogo } from "@/components/landing/quiver-logo";

export default function TryPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-8 px-6 py-16">
      <div>
        <QuiverLogo className="h-8 w-auto sm:h-9" />
        <h1 className="font-display mt-8 text-3xl text-foreground">
          Try the payment loop
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          One click, no wallet. A demo-funded real x402 settlement on Arc
          testnet.
        </p>
      </div>

      <TryQuiverPanel />

      <p className="text-center text-xs text-muted-foreground">
        <Link href="/" className="transition-colors hover:text-foreground">
          Landing
        </Link>
        {" · "}
        <Link href="/login" className="transition-colors hover:text-foreground">
          Operator sign-in
        </Link>
        {" · "}
        <Link href="/dashboard" className="transition-colors hover:text-foreground">
          Dashboard
        </Link>
      </p>
    </main>
  );
}
