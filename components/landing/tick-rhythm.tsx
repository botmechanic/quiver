"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

function subscribeReducedMotion(cb: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function getReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Pure CSS tick rhythm — no API calls, no real spend. */
export function TickRhythm() {
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotion,
    () => true,
  );
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (reducedMotion) return;
    const id = window.setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [reducedMotion]);

  const displayTick = reducedMotion ? 12 : tick % 60;
  const rate = 0.0001;
  const total = (displayTick * rate).toFixed(4);

  return (
    <div
      className="rounded-lg border border-border/30 bg-card/60 p-5 font-mono text-sm"
      aria-hidden
    >
      <div className="flex items-center justify-between gap-4 text-muted-foreground">
        <span>tick</span>
        <span className="text-foreground">{displayTick}</span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-4 text-muted-foreground">
        <span>rate</span>
        <span>${rate.toFixed(4)}/s</span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-4 border-t border-border/60 pt-2">
        <span>authorized</span>
        <span
          className={
            !reducedMotion && tick % 3 === 0
              ? "text-signal transition-colors duration-150"
              : "text-foreground"
          }
        >
          ${total}
        </span>
      </div>
      <div className="mt-4 flex gap-1">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className={`h-6 flex-1 rounded-sm border border-border/40 ${
              i < (displayTick % 12)
                ? "bg-primary/20"
                : i === displayTick % 12 && !reducedMotion
                  ? "bg-signal/40 border-signal/50"
                  : "bg-background/50"
            }`}
          />
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground/70">
        Illustration only — not a live stream
      </p>
    </div>
  );
}
