"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/daily", label: "Daily Sync" }
];

export function SiteNav() {
  const pathname = usePathname();
  return (
    <header className="border-b border-border bg-surface">
      <nav className="mx-auto flex max-w-7xl items-center gap-1 px-4 py-2">
        <span className="mr-3 font-display text-sm font-semibold text-text">Daily Sync Board</span>
        {LINKS.map((l) => {
          const active = pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-accent text-text-inverse shadow-sm"
                  : "text-text-muted hover:bg-surface-alt hover:text-text"
              )}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
