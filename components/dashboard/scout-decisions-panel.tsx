"use client";

import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useScoutDecisions } from "@/hooks/use-scout-decisions";

export function ScoutDecisionsPanel() {
  const { decisions, loading } = useScoutDecisions(null);

  const buys = decisions.filter((d) => d.action === "buy").length;
  const declines = decisions.filter((d) => d.action === "decline").length;

  return (
    <section className="rounded-xl border border-primary/40 bg-card p-6 text-foreground shadow-lg">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-primary">
            Scout agent
          </p>
          <h2 className="mt-2 text-xl font-semibold text-accent-foreground">
            Buy / decline decisions
          </h2>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Each row is a Scout choice against Archer&apos;s quoted price and
            confidence — declines are first-class. Settlements still land in
            Payments when Scout buys.
          </p>
        </div>
        {decisions.length > 0 && (
          <div className="flex gap-2">
            <Badge className="border-signal/50 bg-signal/20 text-signal">
              {buys} bought
            </Badge>
            <Badge className="border-primary/50 bg-primary/20 text-accent-foreground">
              {declines} declined
            </Badge>
          </div>
        )}
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Connecting to Scout decisions…
        </p>
      ) : decisions.length === 0 ? (
        <p className="rounded-lg border border-border/40 bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
          No Scout decisions yet. Run{" "}
          <code className="font-mono text-accent-foreground">npm run agent</code>{" "}
          against deployed Archer — declines and buys appear here in real time.
        </p>
      ) : (
        <div className="max-h-48 overflow-y-auto rounded-md border border-border/40 bg-muted/30 px-3 py-2 font-mono text-xs">
          {decisions.slice(-12).map((d) => (
            <div
              key={d.id}
              className="border-b border-border/30 py-2 last:border-0"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={
                    d.action === "buy"
                      ? "font-semibold text-signal"
                      : "font-semibold text-accent-foreground"
                  }
                >
                  {d.action === "buy" ? "BOUGHT" : "DECLINED"}
                </span>
                <span className="text-foreground/90">{d.endpoint}</span>
                <span className="text-muted-foreground">
                  conf {Number(d.confidence).toFixed(2)} · $
                  {d.price_usdc}
                </span>
              </div>
              <p className="mt-1 text-muted-foreground">{d.reason}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
