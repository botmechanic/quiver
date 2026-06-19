import Link from "next/link";
import { QuiverLogo } from "@/components/landing/quiver-logo";

export function LandingNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <QuiverLogo variant="mark" />
          <QuiverLogo variant="wordmark" className="text-lg sm:text-xl" />
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link
            href="/try"
            className="hidden text-muted-foreground transition-colors hover:text-foreground sm:inline"
          >
            Try
          </Link>
          <Link
            href="/dashboard"
            className="hidden text-muted-foreground transition-colors hover:text-foreground sm:inline"
          >
            Dashboard
          </Link>
          <Link
            href="/login"
            className="text-xs text-muted-foreground transition-colors hover:text-primary sm:text-sm"
          >
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}
