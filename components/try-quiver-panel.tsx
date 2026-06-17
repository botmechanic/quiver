"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface DemoBuyResponse {
  demo: true;
  source: "demo";
  label: string;
  endpoint: string;
  settlement: {
    amount_usdc: string;
    transaction: string;
    payer: string;
    elapsed_ms: number;
    total_elapsed_ms: number;
  };
  archer: {
    price_usdc?: string;
    price_reason?: string;
    signal?: {
      symbol: string;
      decision: string;
      confidence: number;
    };
    reasoning?: {
      trace_hash: string;
      verification?: string;
    };
  };
}

interface DemoBuyError {
  error: string;
  message?: string;
  retry_after_seconds?: number;
}

export function TryQuiverPanel() {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<DemoBuyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDemoBuy() {
    setPending(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/demo/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: "signal" }),
      });
      const data = (await res.json()) as DemoBuyResponse | DemoBuyError;

      if (!res.ok) {
        const err = data as DemoBuyError;
        setError(
          err.retry_after_seconds
            ? `${err.message ?? err.error} (${err.retry_after_seconds}s cooldown)`
            : err.message ?? err.error ?? "Demo buy failed",
        );
        return;
      }

      setResult(data as DemoBuyResponse);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  const signal = result?.archer.signal;
  const elapsedSec = result
    ? (result.settlement.elapsed_ms / 1000).toFixed(2)
    : null;

  return (
    <section className="rounded-xl border border-[#7A5C1E]/60 bg-[#0B0B0D] p-6 text-[#EDE6D6] shadow-lg">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-[0.2em] text-[#D4AF37]">
          Try Quiver
        </p>
        <h2 className="mt-2 text-xl font-semibold text-[#E8C766]">
          Buy one Archer signal — no wallet needed
        </h2>
        <p className="mt-2 text-sm text-[#EDE6D6]/80">
          This button triggers a{" "}
          <strong className="font-medium text-[#EDE6D6]">demo-funded</strong> real
          x402 payment from Quiver&apos;s funder wallet. It settles on Arc like
          Scout — but counts as a demo buy, not a distinct paying visitor.
        </p>
      </div>

      <Button
        type="button"
        onClick={handleDemoBuy}
        disabled={pending}
        className="w-full bg-[#D4AF37] text-[#0B0B0D] hover:bg-[#E8C766] font-semibold"
      >
        {pending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Settling on Arc…
          </>
        ) : (
          "Buy Archer signal (demo)"
        )}
      </Button>

      {error && (
        <p className="mt-4 rounded-md border border-red-500/40 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      {result && signal && (
        <div className="mt-4 space-y-3 rounded-lg border border-[#3FB950]/40 bg-[#3FB950]/10 px-4 py-3">
          <p className="text-sm font-medium text-[#3FB950]">
            Settled — Archer sold a signal for ${result.settlement.amount_usdc}{" "}
            USDC in {elapsedSec}s
          </p>
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-[#EDE6D6]/70">Decision</dt>
              <dd className="font-mono uppercase">{signal.decision}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[#EDE6D6]/70">Confidence</dt>
              <dd className="font-mono">{signal.confidence.toFixed(2)}</dd>
            </div>
            {result.archer.price_reason && (
              <div>
                <dt className="text-[#EDE6D6]/70">Archer price</dt>
                <dd className="mt-1 font-mono text-xs">{result.archer.price_reason}</dd>
              </div>
            )}
            {result.archer.reasoning?.trace_hash && (
              <div>
                <dt className="text-[#EDE6D6]/70">Trace hash (verifiable)</dt>
                <dd className="mt-1 break-all font-mono text-xs">
                  {result.archer.reasoning.trace_hash}
                </dd>
              </div>
            )}
          </dl>
          <p className="text-xs text-[#EDE6D6]/60">{result.label}</p>
        </div>
      )}
    </section>
  );
}
