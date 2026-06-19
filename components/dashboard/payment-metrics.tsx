"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import type { PaymentEvent } from "@/hooks/use-transactions";
import {
  formatUsdcTotal,
  getPaymentSource,
} from "@/lib/payments";

function StatCard({
  label,
  value,
  detail,
  accent,
}: {
  label: string;
  value: string;
  detail: string;
  accent?: "gold" | "green";
}) {
  const valueClass =
    accent === "green"
      ? "text-signal"
      : accent === "gold"
        ? "text-accent-foreground"
        : "";

  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-semibold font-mono ${valueClass}`}>
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

export function PaymentMetrics({ events }: { events: PaymentEvent[] }) {
  const stats = useMemo(() => {
    const demoEvents = events.filter((ev) => getPaymentSource(ev) === "demo");
    const scoutEvents = events.filter((ev) => getPaymentSource(ev) === "scout");
    const streamEvents = events.filter((ev) => getPaymentSource(ev) === "stream");
    const scoutPayers = new Set(scoutEvents.map((ev) => ev.payer.toLowerCase()));

    return {
      demoCount: demoEvents.length,
      demoVolume: formatUsdcTotal(demoEvents),
      scoutCount: scoutEvents.length,
      scoutVolume: formatUsdcTotal(scoutEvents),
      streamCount: streamEvents.length,
      streamVolume: formatUsdcTotal(streamEvents),
      scoutPayers: scoutPayers.size,
    };
  }, [events]);

  return (
    <div className="mb-6 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          Payment metrics (reported separately)
        </h2>
        <Badge variant="outline" className="text-xs">
          demo ≠ distinct payers
        </Badge>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Demo buys"
          value={String(stats.demoCount)}
          detail={`$${stats.demoVolume} USDC — funder-funded Try Quiver clicks`}
          accent="gold"
        />
        <StatCard
          label="Scout payments"
          value={String(stats.scoutCount)}
          detail={`$${stats.scoutVolume} USDC — agent buyer settlements`}
        />
        <StatCard
          label="Stream ticks"
          value={String(stats.streamCount)}
          detail={`$${stats.streamVolume} USDC authorized (verified, not settled)`}
          accent="green"
        />
        <StatCard
          label="Distinct Scout payers"
          value={String(stats.scoutPayers)}
          detail="Ephemeral wallets used by Scout runs"
        />
        <StatCard
          label="Total settled"
          value={String(events.length)}
          detail={`$${formatUsdcTotal(events)} USDC across all sources`}
        />
      </div>
    </div>
  );
}
