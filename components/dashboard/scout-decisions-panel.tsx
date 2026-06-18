"use client";

import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useScoutDecisions } from "@/hooks/use-scout-decisions";

export function ScoutDecisionsPanel() {
  const { decisions, loading } = useScoutDecisions(null);

  const buys = decisions.filter((d) => d.action === "buy").length;
  const declines = decisions.filter((d) => d.action === "decline").length;

  return (
    <section className="rounded-xl border border-[#D4AF37]/40 bg-[#0B0B0D] p-6 text-[#EDE6D6] shadow-lg">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#D4AF37]">
            Scout agent
          </p>
          <h2 className="mt-2 text-xl font-semibold text-[#E8C766]">
            Buy / decline decisions
          </h2>
          <p className="mt-2 max-w-xl text-sm text-[#EDE6D6]/80">
            Each row is a Scout choice against Archer&apos;s quoted price and
            confidence — declines are first-class. Settlements still land in
            Payments when Scout buys.
          </p>
        </div>
        {decisions.length > 0 && (
          <div className="flex gap-2">
            <Badge className="bg-[#3FB950]/20 text-[#3FB950] border-[#3FB950]/50">
              {buys} bought
            </Badge>
            <Badge className="bg-[#D4AF37]/20 text-[#E8C766] border-[#D4AF37]/50">
              {declines} declined
            </Badge>
          </div>
        )}
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-[#EDE6D6]/60">
          <Loader2 className="h-4 w-4 animate-spin" />
          Connecting to Scout decisions…
        </p>
      ) : decisions.length === 0 ? (
        <p className="rounded-lg border border-[#7A5C1E]/30 bg-black/30 px-4 py-6 text-sm text-[#EDE6D6]/60">
          No Scout decisions yet. Run{" "}
          <code className="font-mono text-[#E8C766]">npm run agent</code> against
          deployed Archer — declines and buys appear here in real time.
        </p>
      ) : (
        <div className="max-h-48 overflow-y-auto rounded-md border border-[#7A5C1E]/30 bg-black/30 px-3 py-2 font-mono text-xs">
          {decisions.slice(-12).map((d) => (
            <div
              key={d.id}
              className="border-b border-[#7A5C1E]/20 py-2 last:border-0"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={
                    d.action === "buy"
                      ? "text-[#3FB950] font-semibold"
                      : "text-[#E8C766] font-semibold"
                  }
                >
                  {d.action === "buy" ? "BOUGHT" : "DECLINED"}
                </span>
                <span className="text-[#EDE6D6]/90">{d.endpoint}</span>
                <span className="text-[#EDE6D6]/50">
                  conf {Number(d.confidence).toFixed(2)} · $
                  {d.price_usdc}
                </span>
              </div>
              <p className="mt-1 text-[#EDE6D6]/75">{d.reason}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
