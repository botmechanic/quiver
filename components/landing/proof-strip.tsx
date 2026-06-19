"use client";

import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { usePaymentEvents } from "@/hooks/use-transactions";
import {
  formatUsdcTotal,
  getPaymentSource,
} from "@/lib/payments";

function ProofStat({
  label,
  value,
  detail,
  live,
}: {
  label: string;
  value: string;
  detail: string;
  live?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card/40 px-4 py-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-1 font-mono text-2xl font-semibold ${
          live ? "text-signal" : "text-accent-foreground"
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

/** Live counters from payment_events — demo and Scout reported separately. */
export function ProofStrip() {
  const { events, loading } = usePaymentEvents();

  const stats = useMemo(() => {
    const demo = events.filter((ev) => getPaymentSource(ev) === "demo");
    const scout = events.filter((ev) => getPaymentSource(ev) === "scout");
    const allAmounts = events.map((ev) => parseFloat(ev.amount_usdc || "0"));
    const avg =
      allAmounts.length > 0
        ? allAmounts.reduce((a, b) => a + b, 0) / allAmounts.length
        : 0;

    return {
      demoCount: demo.length,
      scoutCount: scout.length,
      avgSize: avg.toFixed(6),
      demoVolume: formatUsdcTotal(demo),
      scoutVolume: formatUsdcTotal(scout),
    };
  }, [events]);

  if (loading) {
    return (
      <section className="border-b border-border/40 py-10">
        <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 text-sm text-muted-foreground sm:px-6">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading on-chain proof…
        </div>
      </section>
    );
  }

  if (events.length === 0) {
    return (
      <section className="border-b border-border/40 py-10">
        <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
          <p className="text-sm text-muted-foreground">
            No settlements recorded yet —{" "}
            <a href="/try" className="text-primary hover:underline">
              trigger the first demo buy
            </a>
            .
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="border-b border-border/40 py-10 sm:py-14">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            Live proof from Arc testnet
          </h2>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-signal/40 bg-signal/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-signal">
            <span className="h-1.5 w-1.5 rounded-full bg-signal" aria-hidden />
            Realtime
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ProofStat
            label="Demo settlements"
            value={String(stats.demoCount)}
            detail={`$${stats.demoVolume} USDC — funder-funded /try clicks`}
          />
          <ProofStat
            label="Scout payments"
            value={String(stats.scoutCount)}
            detail={`$${stats.scoutVolume} USDC — agent buyer runs`}
          />
          <ProofStat
            label="Avg transaction"
            value={`$${stats.avgSize}`}
            detail="Sub-cent target across all sources"
          />
          <ProofStat
            label="Total events"
            value={String(events.length)}
            detail="All payment_events rows (demo ≠ distinct payers)"
          />
        </div>
      </div>
    </section>
  );
}
