"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

// Shared collapsible card-style shell used by every section so the page reads
// as one consistent surface.
export function SectionShell({
  title,
  count,
  countLabel = "items",
  rightSlot,
  children,
  defaultOpen = true
}: {
  title: string;
  count: number;
  countLabel?: string;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex flex-1 items-center gap-2 text-left"
        >
          <span className="text-text-muted">{open ? "▾" : "▸"}</span>
          <h2 className="font-display text-base font-semibold tracking-tight text-text">{title}</h2>
          <span className="text-xs text-text-muted">
            {count} {countLabel}
          </span>
        </button>
        {rightSlot}
      </div>
      <div className={cn("transition-all", open ? "block" : "hidden")}>{children}</div>
    </section>
  );
}
