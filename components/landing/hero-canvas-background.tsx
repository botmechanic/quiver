"use client";

import dynamic from "next/dynamic";

const QuiverCanvas = dynamic(
  () =>
    import("@/components/landing/quiver-canvas").then((m) => m.QuiverCanvas),
  {
    ssr: false,
    loading: () => (
      <div
        className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent-foreground/5"
        aria-hidden
      />
    ),
  },
);

export function HeroCanvasBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 h-full min-h-[420px] sm:min-h-[520px]">
      <QuiverCanvas className="h-full w-full" />
    </div>
  );
}
