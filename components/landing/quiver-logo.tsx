import { cn } from "@/lib/utils";

type QuiverLogoProps = {
  className?: string;
  priority?: boolean;
};

/** Full brand lockup — scale by height; width follows ~1.9:1 aspect ratio. */
export function QuiverLogo({ className, priority }: QuiverLogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/quiver-logo.svg"
      alt="Quiver"
      width={1460}
      height={769}
      decoding="async"
      fetchPriority={priority ? "high" : undefined}
      className={cn("h-8 w-auto sm:h-9", className)}
    />
  );
}
