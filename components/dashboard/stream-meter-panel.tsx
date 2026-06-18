"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Square } from "lucide-react";
import { useStreamEvents } from "@/hooks/use-stream-events";

const STREAM_RATE_USDC = 0.0001;

interface StreamStartResponse {
  session_id: string;
  rate_usdc: string;
  label: string;
}

interface StreamStopResponse {
  tick_count: number;
  authorized_total_usdc: string;
  rate_usdc: string;
  invariant: {
    formula: string;
    holds: boolean;
  };
  label: string;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function StreamMeterPanel() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [localTicks, setLocalTicks] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [durationSec, setDurationSec] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [stopSummary, setStopSummary] = useState<StreamStopResponse | null>(
    null,
  );
  const [pendingTick, setPendingTick] = useState(false);

  const tickRef = useRef(0);
  const durationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stoppingRef = useRef(false);
  const runningRef = useRef(false);

  const { events, loading, cumulativeUsdc, tickCount } =
    useStreamEvents(sessionId);

  const verifiedTicks = sessionId ? tickCount || localTicks : 0;
  const authorizedTotal = sessionId
    ? parseFloat(cumulativeUsdc || "0")
    : 0;
  const expectedTotal = Number((verifiedTicks * STREAM_RATE_USDC).toFixed(6));
  const invariantHolds =
    verifiedTicks === 0 ||
    Math.abs(authorizedTotal - expectedTotal) < 0.000001;

  useEffect(() => {
    if (!running || !startedAt) return;
    durationRef.current = setInterval(() => {
      setDurationSec(Math.floor((Date.now() - startedAt) / 1000));
    }, 250);
    return () => {
      if (durationRef.current) clearInterval(durationRef.current);
    };
  }, [running, startedAt]);

  const clearTimers = useCallback(() => {
    if (durationRef.current) {
      clearInterval(durationRef.current);
      durationRef.current = null;
    }
  }, []);

  const stopStream = useCallback(async () => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    runningRef.current = false;
    clearTimers();
    setRunning(false);

    if (!sessionId) {
      stoppingRef.current = false;
      return;
    }

    try {
      const res = await fetch("/api/demo/stream/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });
      const data = (await res.json()) as StreamStopResponse & {
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        setError(data.message ?? data.error ?? "Stop failed");
      } else {
        setStopSummary(data);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      stoppingRef.current = false;
    }
  }, [sessionId, clearTimers]);

  const fireTick = useCallback(async (sid: string) => {
    if (stoppingRef.current) return;
    const nextTick = tickRef.current + 1;
    setPendingTick(true);

    try {
      const res = await fetch("/api/demo/stream/tick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sid, tick: nextTick }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.message ?? data.error ?? "Tick failed");
        await stopStream();
        return;
      }

      tickRef.current = nextTick;
      setLocalTicks(nextTick);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
      await stopStream();
    } finally {
      setPendingTick(false);
    }
  }, [stopStream]);

  const runTickLoop = useCallback(
    async (sid: string) => {
      while (runningRef.current && !stoppingRef.current) {
        await fireTick(sid);
        if (!runningRef.current || stoppingRef.current) break;
        await new Promise((r) => setTimeout(r, 1000));
      }
    },
    [fireTick],
  );

  const startStream = useCallback(async () => {
    setError(null);
    setStopSummary(null);
    setLocalTicks(0);
    tickRef.current = 0;
    setDurationSec(0);

    try {
      const res = await fetch("/api/demo/stream/start", { method: "POST" });
      const data = (await res.json()) as StreamStartResponse & {
        error?: string;
        message?: string;
        retry_after_seconds?: number;
      };

      if (!res.ok) {
        setError(
          data.retry_after_seconds
            ? `${data.message ?? data.error} (${data.retry_after_seconds}s cooldown)`
            : data.message ?? data.error ?? "Could not start stream",
        );
        return;
      }

      const now = Date.now();
      setSessionId(data.session_id);
      setStartedAt(now);
      setRunning(true);
      runningRef.current = true;
      stoppingRef.current = false;

      void runTickLoop(data.session_id);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [runTickLoop]);

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  const displayTicks = stopSummary?.tick_count ?? verifiedTicks;
  const displayTotal = stopSummary
    ? parseFloat(stopSummary.authorized_total_usdc)
    : authorizedTotal;
  const displayExpected = Number(
    (displayTicks * STREAM_RATE_USDC).toFixed(6),
  );
  const showInvariant =
    stopSummary !== null || (!running && displayTicks > 0);

  return (
    <section className="rounded-xl border border-[#3FB950]/40 bg-[#0B0B0D] p-6 text-[#EDE6D6] shadow-lg">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#3FB950]">
            Live stream
          </p>
          <h2 className="mt-2 text-xl font-semibold text-[#E8C766]">
            Pay-per-second Archer feed
          </h2>
          <p className="mt-2 max-w-xl text-sm text-[#EDE6D6]/80">
            Each second signs one EIP-3009 authorization (~$
            {STREAM_RATE_USDC.toFixed(4)}/s). The meter shows{" "}
            <strong className="text-[#3FB950]">authorized / verified</strong>{" "}
            volume — settlement batches later on Arc.
          </p>
        </div>
        {running && (
          <Badge className="bg-[#3FB950]/20 text-[#3FB950] border-[#3FB950]/50 animate-pulse">
            LIVE
          </Badge>
        )}
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-[#7A5C1E]/40 bg-black/40 p-4">
          <p className="text-xs uppercase tracking-wide text-[#EDE6D6]/60">
            Authorized total
          </p>
          <p className="mt-1 font-mono text-3xl font-semibold text-[#3FB950]">
            ${displayTotal.toFixed(6)}
          </p>
          <p className="mt-1 text-xs text-[#EDE6D6]/50">verified, not settled</p>
        </div>
        <div className="rounded-lg border border-[#7A5C1E]/40 bg-black/40 p-4">
          <p className="text-xs uppercase tracking-wide text-[#EDE6D6]/60">
            Rate
          </p>
          <p className="mt-1 font-mono text-2xl font-semibold text-[#E8C766]">
            ${STREAM_RATE_USDC.toFixed(4)}/s
          </p>
          <p className="mt-1 text-xs text-[#EDE6D6]/50">
            {displayTicks} tick{displayTicks !== 1 ? "s" : ""}
            {pendingTick ? " · signing…" : ""}
          </p>
        </div>
        <div className="rounded-lg border border-[#7A5C1E]/40 bg-black/40 p-4">
          <p className="text-xs uppercase tracking-wide text-[#EDE6D6]/60">
            Session duration
          </p>
          <p className="mt-1 font-mono text-2xl font-semibold">
            {formatDuration(durationSec)}
          </p>
          <p className="mt-1 truncate font-mono text-xs text-[#EDE6D6]/50">
            {sessionId ? sessionId.slice(0, 8) + "…" : "—"}
          </p>
        </div>
      </div>

      {showInvariant && (
        <div
          className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
            invariantHolds && stopSummary?.invariant.holds !== false
              ? "border-[#3FB950]/50 bg-[#3FB950]/10 text-[#3FB950]"
              : "border-red-500/50 bg-red-950/30 text-red-200"
          }`}
        >
          <p className="font-medium">Exact-cost invariant</p>
          <p className="mt-1 font-mono text-xs">
            {displayTicks} × ${STREAM_RATE_USDC.toFixed(4)} = $
            {displayExpected.toFixed(6)}
            {invariantHolds ? " ✓" : " ✗ drift"}
          </p>
          {stopSummary && (
            <p className="mt-2 text-xs opacity-80">{stopSummary.label}</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {!running ? (
          <Button
            type="button"
            onClick={() => void startStream()}
            disabled={loading}
            className="bg-[#3FB950] text-[#0B0B0D] hover:bg-[#3FB950]/90 font-semibold"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting…
              </>
            ) : (
              "Start stream"
            )}
          </Button>
        ) : (
          <Button
            type="button"
            onClick={() => void stopStream()}
            variant="outline"
            className="border-[#D4AF37] text-[#E8C766] hover:bg-[#D4AF37]/10"
          >
            <Square className="mr-2 h-4 w-4 fill-current" />
            Stop stream
          </Button>
        )}
      </div>

      {error && (
        <p className="mt-4 rounded-md border border-red-500/40 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      {events.length > 0 && (
        <div className="mt-4 max-h-32 overflow-y-auto rounded-md border border-[#7A5C1E]/30 bg-black/30 px-3 py-2 font-mono text-xs text-[#EDE6D6]/70">
          {events.slice(-8).map((ev) => (
            <div key={ev.id} className="flex justify-between gap-4 py-0.5">
              <span>
                tick {ev.tick_number}{" "}
                <span className="text-[#3FB950]">{ev.status}</span>
              </span>
              <span>${ev.cumulative_usdc} cum</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
