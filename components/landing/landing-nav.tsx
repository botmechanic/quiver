"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { QuiverLogo } from "@/components/landing/quiver-logo";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#streaming", label: "Streaming" },
  { href: "/dashboard", label: "Dashboard" },
] as const;

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-[background-color,backdrop-filter,border-color] duration-300",
        scrolled
          ? "border-b border-border/25 bg-background/70 backdrop-blur-md"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-6 px-5 py-4 sm:px-8 sm:py-5">
        <Link href="/" className="shrink-0" aria-label="Quiver home">
          <QuiverLogo
            priority
            className="h-7 w-auto sm:h-8 md:h-10 lg:h-11"
          />
        </Link>

        <nav className="flex items-center gap-5 sm:gap-7">
          <div className="hidden items-center gap-5 md:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-muted-foreground transition-colors hover:text-primary"
              >
                {link.label}
              </Link>
            ))}
          </div>
          <Button asChild size="sm" className="font-semibold">
            <Link href="/try">Try Quiver</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
