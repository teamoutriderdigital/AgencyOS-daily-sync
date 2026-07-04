"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/daily", label: "Daily Sync" },
  { href: "/weekly", label: "Weekly L10" },
  { href: "/rocks", label: "Q3 Rocks" }
];

export function SiteNav() {
  const pathname = usePathname();
  return (
    <header className="border-b border-border bg-surface">
      <nav className="mx-auto flex max-w-7xl flex-wrap items-center gap-1 gap-y-2 px-4 py-2">
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
        <div className="ml-auto shrink-0">
          <ShareLinkButton />
        </div>
      </nav>
    </header>
  );
}

// Copies the public /submit URL to the clipboard so anyone can be handed a link
// to drop topics into the queue.
function ShareLinkButton() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const url = `${window.location.origin}/submit`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("Copy this shareable link:", url);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text-muted transition-colors hover:bg-surface-alt hover:text-text"
      title="Copy the public topic-submission link"
    >
      {copied ? "✓ Copied!" : "🔗 Copy Shareable Link"}
    </button>
  );
}
