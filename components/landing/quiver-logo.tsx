import Image from "next/image";
import { cn } from "@/lib/utils";

type QuiverLogoProps = {
  variant?: "full" | "mark" | "wordmark";
  className?: string;
};

/** Fixed-aspect wrapper — SVG uses preserveAspectRatio="none"; always constrain height. */
export function QuiverLogo({
  variant = "full",
  className,
}: QuiverLogoProps) {
  if (variant === "wordmark") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-2 font-display text-2xl tracking-[0.2em] text-accent-foreground uppercase",
          className,
        )}
      >
        Quiver
      </span>
    );
  }

  return (
    <div
      className={cn(
        "relative aspect-square overflow-hidden rounded-sm",
        variant === "mark" ? "w-12" : "w-16 sm:w-20",
        className,
      )}
    >
      <Image
        src="/quiver-logo.svg"
        alt="Quiver"
        fill
        className="object-cover object-center"
        priority
        sizes="80px"
      />
    </div>
  );
}
