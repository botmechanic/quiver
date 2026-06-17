import { TryQuiverPanel } from "@/components/try-quiver-panel";
import Link from "next/link";

export default function TryPage() {
  return (
    <main className="quiver-public min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 p-6">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-[#D4AF37]">
            Quiver
          </p>
          <h1 className="mt-3 text-3xl font-bold text-[#E8C766]">
            Try the payment loop
          </h1>
          <p className="mt-3 text-sm text-[#EDE6D6]/80">
            One click, no wallet. A demo-funded real x402 settlement on Arc.
          </p>
        </div>

        <TryQuiverPanel />

        <p className="text-center text-xs text-[#EDE6D6]/50">
          <Link href="/" className="text-[#D4AF37] hover:underline">
            Operator sign-in
          </Link>
          {" · "}
          <Link href="/dashboard" className="text-[#D4AF37] hover:underline">
            Dashboard
          </Link>
        </p>
      </div>
    </main>
  );
}
