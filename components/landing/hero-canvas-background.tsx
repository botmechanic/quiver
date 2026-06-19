"use client";

import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";

const QuiverCanvas = dynamic(
  () =>
    import("@/components/landing/quiver-canvas").then((m) => m.QuiverCanvas),
  {
    ssr: false,
    loading: () => (
      <div
        className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent"
        aria-hidden
      />
    ),
  },
);

type HeroCanvasBackgroundProps = {
  className?: string;
};

export function HeroCanvasBackground({ className }: HeroCanvasBackgroundProps) {
  return (
    <div className={cn("relative min-h-[280px] w-full", className)}>
      <QuiverCanvas className="absolute inset-0 h-full w-full" />
    </div>
  );
}
