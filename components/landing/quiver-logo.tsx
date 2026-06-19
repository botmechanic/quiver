import { cn } from "@/lib/utils";

type QuiverLogoProps = {
  className?: string;
  priority?: boolean;
};

/**
 * Full brand lockup — SVG already includes the QUIVER wordmark and arrow mark.
 * Scale by height; width follows aspect ratio (never stretch).
 */
export function QuiverLogo({ className, priority }: QuiverLogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/quiver-logo.svg"
      alt="Quiver"
      width={120}
      height={120}
      decoding="async"
      fetchPriority={priority ? "high" : undefined}
      className={cn("h-8 w-auto sm:h-9", className)}
    />
  );
}
