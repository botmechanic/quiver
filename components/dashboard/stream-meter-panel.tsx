"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Square } from "lucide-react";
import { useStreamEvents, type StreamEvent } from "@/hooks/use-stream-events";
import type { PaymentEvent } from "@/hooks/use-transactions";
import { getPaymentSource } from "@/lib/payments";
import {
  STREAM_RATE_USDC,
  buildStreamInvariant,
  streamCloseLabel,
  tickTimeoutMs,
} from "@/lib/stream/constants";
import {
  FetchTimeoutError,
  fetchWithTimeout,
} from "@/lib/stream/fetch-with-timeout";

interface StreamStartResponse {
  session_id: string;
  rate_usdc: string;
  label: string;
  max_ticks?: number;
}

interface StreamStopResponse {
  tick_count: number;
  authorized_total_usdc: string;
  rate_usdc: string;
  reason?: string;
  fail_closed?: boolean;
  session_row_missing?: boolean;
  session_tick_drift?: boolean;
  invariant: {
    formula: string;
    holds: boolean;
  };
  label: string;
}

type CloseReason = "user" | "tick_timeout" | "tick_failed";
type StreamSource = "agent" | "creator" | "unknown";

const STREAM_COPY: Record<
  StreamSource,
  { eyebrow: string; title: string; body: string }
> = {
  agent: {
    eyebrow: "Agent stream",
    title: "Agent stream · Scout ↔ Archer",
    body: "Scout signs one authorization per second for Archer's live feed. Same meter, same exact-cost invariant.",
  },
  creator: {
    eyebrow: "Creator stream",
    title: "Creator stream · Owncast",
    body: "Chat-active Owncast presence opens the stream; USER_PARTED or heartbeat closes it. Same rail, same exact-cost invariant.",
  },
  unknown: {
    eyebrow: "Live stream",
    title: "Pay-per-second stream",
    body: "Start a stream to watch verified seconds accrue. The meter labels the source once stream_events identify it.",
  },
};

function detectStreamSource({
  events,
  paymentEvents,
  sessionId,
  starting,
}: {
  events: StreamEvent[];
  paymentEvents: PaymentEvent[];
  sessionId: string | null;
  starting: boolean;
}): StreamSource {
  if (
    events.some(
      (event) =>
        event.raw?.owncast_user_id != null ||
        event.raw?.owncast_event_type != null,
    )
  ) {
    return "creator";
  }

  if (sessionId || starting) return "agent";

  const latestStreamPayment = paymentEvents.find(
    (event) => getPaymentSource(event) === "stream",
  );
  if (!latestStreamPayment) return "unknown";

  if (
    latestStreamPayment.raw?.owncast_user_id != null ||
    latestStreamPayment.raw?.owncast_event_type != null
  ) {
    return "creator";
  }

  return "agent";
}

function sourceConfidence({
  events,
  paymentEvents,
  sessionId,
  starting,
}: {
  events: StreamEvent[];
  paymentEvents: PaymentEvent[];
  sessionId: string | null;
  starting: boolean;
}): "current" | "recent" | "none" {
  if (events.length > 0 || sessionId || starting) return "current";
  if (paymentEvents.some((event) => getPaymentSource(event) === "stream")) {
    return "recent";
  }
  return "none";
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

async function fetchVerifiedTickCount(sessionId: string): Promise<number> {
  try {
    const res = await fetch(
      `/api/demo/stream/status?session_id=${encodeURIComponent(sessionId)}`,
    );
    if (!res.ok) return 0;
    const data = (await res.json()) as { tick_count?: number };
    return data.tick_count ?? 0;
  } catch {
    return 0;
  }
}

async function pollVerifiedTickCount(
  sessionId: string,
): Promise<number> {
  let best = 0;
  for (let attempt = 0; attempt < 6; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 500));
    }
    const next = await fetchVerifiedTickCount(sessionId);
    if (next >= best) best = next;
  }
  return best;
}

export function StreamMeterPanel({
  paymentEvents = [],
}: {
  paymentEvents?: PaymentEvent[];
}) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [durationSec, setDurationSec] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [stopSummary, setStopSummary] = useState<StreamStopResponse | null>(
    null,
  );
  const [pendingTick, setPendingTick] = useState(false);
  const [pendingTickNumber, setPendingTickNumber] = useState<number | null>(
    null,
  );
  const [failClosed, setFailClosed] = useState(false);
  const [maxTicks, setMaxTicks] = useState<number | null>(null);

  const tickRef = useRef(0);
  const durationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stoppingRef = useRef(false);
  const runningRef = useRef(false);

  const { events, loading, cumulativeUsdc, tickCount } =
    useStreamEvents(sessionId);

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

  const haltLoop = useCallback(() => {
    runningRef.current = false;
    stoppingRef.current = true;
    setRunning(false);
    setPendingTick(false);
    setPendingTickNumber(null);
    clearTimers();
  }, [clearTimers]);

  const buildLocalStopSummary = useCallback(
    (verifiedTickCount: number, reason: CloseReason): StreamStopResponse => {
      const built = buildStreamInvariant(verifiedTickCount);
      return {
        tick_count: built.tick_count,
        authorized_total_usdc: built.authorized_total_usdc,
        rate_usdc: built.rate_usdc,
        invariant: built.invariant,
        label: streamCloseLabel(reason, verifiedTickCount),
        reason,
        fail_closed: reason !== "user",
      };
    },
    [],
  );

  const closeSession = useCallback(
    async (sid: string, reason: CloseReason, detail?: string) => {
      if (stoppingRef.current && reason === "user") return;
      haltLoop();
      setFailClosed(reason !== "user");

      const verifiedTickCount = await pollVerifiedTickCount(sid);

      try {
        const res = await fetchWithTimeout(
          "/api/demo/stream/stop",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_id: sid, reason }),
          },
          10000,
          "Stop stream",
        );
        const data = (await res.json()) as StreamStopResponse & {
          error?: string;
          message?: string;
        };
        if (res.ok) {
          const summary = buildStreamInvariant(data.tick_count ?? 0);
          setStopSummary({
            ...data,
            ...summary,
            reason: data.reason,
            fail_closed: data.fail_closed,
            session_row_missing: data.session_row_missing,
            session_tick_drift: data.session_tick_drift,
          });
          setError((data.tick_count ?? 0) > 0 ? null : detail ?? null);
        } else {
          setStopSummary(buildLocalStopSummary(verifiedTickCount, reason));
          setError(data.message ?? data.error ?? detail ?? "Stop failed");
        }
      } catch {
        const fallback = await pollVerifiedTickCount(sid);
        setStopSummary(buildLocalStopSummary(fallback, reason));
        if (detail) setError(detail);
      } finally {
        stoppingRef.current = false;
      }
    },
    [haltLoop, buildLocalStopSummary],
  );

  const stopStream = useCallback(async () => {
    if (!sessionId) return;
    await closeSession(sessionId, "user");
  }, [sessionId, closeSession]);

  const fireTick = useCallback(
    async (sid: string, cap: number | null) => {
      if (stoppingRef.current || !runningRef.current) return;

      const nextTick = tickRef.current + 1;
      setPendingTick(true);
      setPendingTickNumber(nextTick);

      try {
        const timeoutMs = tickTimeoutMs(nextTick);
        const res = await fetchWithTimeout(
          "/api/demo/stream/tick",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_id: sid, tick: nextTick }),
          },
          timeoutMs,
          `Tick ${nextTick}`,
        );
        const data = await res.json();

        if (!res.ok) {
          const message =
            data.message ?? data.error ?? `Tick ${nextTick} failed`;
          await closeSession(
            sid,
            res.status === 504 ? "tick_timeout" : "tick_failed",
            message,
          );
          return;
        }

        tickRef.current = nextTick;
        setError(null);
        setFailClosed(false);

        if (cap !== null && nextTick >= cap) {
          await closeSession(sid, "user");
        }
      } catch (err) {
        if (err instanceof FetchTimeoutError) {
          await closeSession(
            sid,
            "tick_timeout",
            `Tick ${nextTick} timed out — stream closed. Charged only for ${tickRef.current} verified tick(s); no further authorizations signed.`,
          );
          return;
        }
        await closeSession(
          sid,
          "tick_failed",
          err instanceof Error ? err.message : String(err),
        );
      } finally {
        setPendingTick(false);
        setPendingTickNumber(null);
      }
    },
    [closeSession],
  );

  const runTickLoop = useCallback(
    async (sid: string, cap: number | null) => {
      while (runningRef.current && !stoppingRef.current) {
        await fireTick(sid, cap);
        if (!runningRef.current || stoppingRef.current) break;
        await new Promise((r) => setTimeout(r, 1000));
      }
    },
    [fireTick],
  );

  const startStream = useCallback(async () => {
    if (starting || runningRef.current) return;

    setStarting(true);
    setError(null);
    setStopSummary(null);
    setFailClosed(false);
    setMaxTicks(null);
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
      const cap = Number.isFinite(data.max_ticks) ? data.max_ticks ?? null : null;
      setSessionId(data.session_id);
      setStartedAt(now);
      setRunning(true);
      setMaxTicks(cap);
      runningRef.current = true;
      stoppingRef.current = false;

      void runTickLoop(data.session_id, cap);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setStarting(false);
    }
  }, [runTickLoop, starting]);

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  useEffect(() => {
    if (!sessionId || running) return;
    setStopSummary((prev) => {
      if (!prev || tickCount <= (prev.tick_count ?? 0)) return prev;
      return { ...prev, ...buildStreamInvariant(tickCount) };
    });
  }, [tickCount, sessionId, running]);

  const displayTicks =
    stopSummary !== null ? stopSummary.tick_count : tickCount;
  const displayTotal =
    stopSummary !== null
      ? parseFloat(stopSummary.authorized_total_usdc)
      : parseFloat(cumulativeUsdc || "0");
  const displayExpected = Number(
    (displayTicks * STREAM_RATE_USDC).toFixed(6),
  );
  const displayInvariantHolds =
    displayTicks === 0 ||
    Math.abs(displayTotal - displayExpected) < 0.000001;
  const showInvariant =
    stopSummary !== null || (!running && displayTicks > 0);
  const closeLabel =
    stopSummary?.reason != null
      ? streamCloseLabel(
          stopSummary.reason as CloseReason,
          stopSummary.tick_count,
        )
      : null;
  const sourceState = sourceConfidence({
    events,
    paymentEvents,
    sessionId,
    starting,
  });
  const streamCopy =
    STREAM_COPY[
      detectStreamSource({ events, paymentEvents, sessionId, starting })
    ];

  return (
    <section className="rounded-xl border border-border/40 bg-card p-6 text-foreground shadow-lg">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {streamCopy.eyebrow}
          </p>
          <h2 className="mt-2 text-xl font-semibold text-accent-foreground">
            {streamCopy.title}
          </h2>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            {streamCopy.body} The meter shows{" "}
            <strong className="text-signal">authorized / verified</strong>{" "}
            volume — settlement batches later on Arc. Demo streams are capped
            to protect the funder wallet.
            {sourceState === "recent"
              ? " Source label reflects the most recent stream payment."
              : ""}
          </p>
        </div>
        {running && (
          <Badge className="border-signal/50 bg-signal/20 text-signal animate-pulse">
            LIVE
          </Badge>
        )}
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border/40 bg-muted/30 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Authorized total
          </p>
          <p className="mt-1 font-mono text-3xl font-semibold text-signal">
            ${displayTotal.toFixed(6)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">verified, not settled</p>
        </div>
        <div className="rounded-lg border border-border/40 bg-muted/30 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Rate
          </p>
          <p className="mt-1 font-mono text-2xl font-semibold text-accent-foreground">
            ${STREAM_RATE_USDC.toFixed(4)}/s
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {displayTicks} tick{displayTicks !== 1 ? "s" : ""}
            {maxTicks !== null ? ` of ${maxTicks} max` : ""}
            {pendingTick && pendingTickNumber !== null
              ? ` · signing tick ${pendingTickNumber}… (max ${tickTimeoutMs(pendingTickNumber) / 1000}s)`
              : ""}
          </p>
        </div>
        <div className="rounded-lg border border-border/40 bg-muted/30 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Session duration
          </p>
          <p className="mt-1 font-mono text-2xl font-semibold">
            {formatDuration(durationSec)}
          </p>
          <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
            {sessionId ? sessionId.slice(0, 8) + "…" : "—"}
          </p>
        </div>
      </div>

      {showInvariant && (
        <div
          aria-live="polite"
          className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
            failClosed
              ? "border-primary/50 bg-primary/10 text-accent-foreground"
              : displayInvariantHolds && stopSummary?.invariant.holds !== false
                ? "border-signal/50 bg-signal/10 text-signal"
                : "border-red-500/50 bg-red-950/30 text-red-200"
          }`}
        >
          <p className="font-medium">
            {failClosed ? "Fail-closed — exact cost preserved" : "Exact-cost invariant"}
          </p>
          <p className="mt-1 font-mono text-xs">
            {displayTicks} × ${STREAM_RATE_USDC.toFixed(4)} = $
            {displayExpected.toFixed(6)}
            {displayInvariantHolds ? " ✓" : " ✗ drift"}
          </p>
          {closeLabel && (
            <p className="mt-2 text-xs opacity-90">{closeLabel}</p>
          )}
          {stopSummary?.session_row_missing && (
            <p className="mt-1 text-xs opacity-75">
              Session row missing in DB — verified ticks reconciled from
              stream_events.
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {!running ? (
          <Button
            type="button"
            onClick={() => void startStream()}
            disabled={loading || starting}
            className="bg-signal font-semibold text-background hover:bg-signal/90"
          >
            {loading || starting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {starting ? "Starting…" : "Connecting…"}
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
            className="border-primary text-accent-foreground hover:bg-primary/10"
          >
            <Square className="mr-2 h-4 w-4 fill-current" />
            Stop stream
          </Button>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-md border border-red-500/40 bg-red-950/30 px-3 py-2 text-sm text-red-200"
        >
          {error}
        </p>
      )}

      {events.length > 0 && (
        <div
          aria-live="polite"
          className="mt-4 max-h-32 overflow-y-auto rounded-md border border-border/30 bg-muted/30 px-3 py-2 font-mono text-xs text-muted-foreground"
        >
          {events.slice(-8).map((ev) => (
            <div key={ev.id} className="flex justify-between gap-4 py-0.5">
              <span>
                tick {ev.tick_number}{" "}
                <span className="text-signal">{ev.status}</span>
              </span>
              <span>${ev.cumulative_usdc} cum</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
