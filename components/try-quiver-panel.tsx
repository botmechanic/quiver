"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { cn, shortenHash } from "@/lib/utils";

const EXPLORER_BASE = "https://testnet.arcscan.app";

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

type TryQuiverPanelProps = {
  variant?: "default" | "landing" | "compact";
  className?: string;
};

export function TryQuiverPanel({
  variant = "default",
  className,
}: TryQuiverPanelProps) {
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
  const transactionHref =
    result?.settlement.transaction?.startsWith("0x")
      ? `${EXPLORER_BASE}/tx/${result.settlement.transaction}`
      : null;

  const isCompact = variant === "compact";

  return (
    <section
      className={cn(
        "rounded-lg border border-border/30 bg-card/80 p-6 text-foreground shadow-sm",
        isCompact && "p-4",
        className,
      )}
    >
      <div className={cn("mb-4", isCompact && "mb-3")}>
        <p className="text-[11px] uppercase tracking-[0.18em] text-primary/70">
          Try Quiver
        </p>
        <h2
          className={cn(
            "mt-4 font-semibold text-foreground",
            isCompact ? "text-xl" : "text-2xl",
            variant === "landing" && "font-display text-2xl leading-[1.15] sm:text-3xl",
          )}
        >
          Buy one Archer signal — no wallet needed
        </h2>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          This button triggers a{" "}
          <strong className="font-medium text-foreground">demo-funded</strong>{" "}
          real x402 payment from Quiver&apos;s funder wallet. It settles on Arc
          like Scout — but counts as a demo buy, not a distinct paying visitor.
          Public demo spending is rate-limited.
        </p>
      </div>

      <Button
        type="button"
        onClick={handleDemoBuy}
        disabled={pending}
        className="w-full font-semibold"
        size={isCompact ? "default" : "lg"}
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
        <p
          role="alert"
          className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      {result && signal && (
        <div
          aria-live="polite"
          className="mt-4 space-y-3 rounded-lg border border-signal/40 bg-signal/10 px-4 py-3"
        >
          <p className="text-sm font-medium text-signal">
            Settled — Archer sold a signal for ${result.settlement.amount_usdc}{" "}
            USDC in {elapsedSec}s
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Quiver funded an ephemeral payer, retried Archer&apos;s x402 402
            quote with a Circle Gateway authorization, and recorded the result
            as a demo buy.
          </p>
          <dl className="grid gap-2 text-sm">
            {transactionHref && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Arcscan proof</dt>
                <dd className="font-mono">
                  <a
                    href={transactionHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    {shortenHash(result.settlement.transaction, 6)}
                  </a>
                </dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Decision</dt>
              <dd className="font-mono uppercase">{signal.decision}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Confidence</dt>
              <dd className="font-mono">{signal.confidence.toFixed(2)}</dd>
            </div>
            {result.archer.price_reason && (
              <div>
                <dt className="text-muted-foreground">Archer price</dt>
                <dd className="mt-1 font-mono text-xs">
                  {result.archer.price_reason}
                </dd>
              </div>
            )}
            {result.archer.reasoning?.trace_hash && (
              <div>
                <dt className="text-muted-foreground">Trace hash (verifiable)</dt>
                <dd className="mt-1 break-all font-mono text-xs">
                  {result.archer.reasoning.trace_hash}
                </dd>
              </div>
            )}
          </dl>
          <p className="text-xs text-muted-foreground">{result.label}</p>
        </div>
      )}
    </section>
  );
}
