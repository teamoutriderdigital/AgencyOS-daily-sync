"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { CLIENTS } from "@/lib/daily";

// Always-visible client selector: the default clients (Redstone, SBD, COD,
// Vital) as toggle buttons, plus "+ Other" to type any custom client. The
// selected client is highlighted; click it again to clear.
export function ClientChips({
  value,
  onChange
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const [other, setOther] = useState(false);
  const customValue = value && !CLIENTS.includes(value) ? value : null;

  const chip = (active: boolean) =>
    cn(
      "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
      active
        ? "border-accent bg-accent text-text-inverse"
        : "border-border bg-surface text-text-muted hover:bg-surface-alt hover:text-text"
    );

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-medium text-text-muted">Client:</span>
      {CLIENTS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => {
            setOther(false);
            onChange(value === c ? null : c);
          }}
          className={chip(value === c)}
        >
          {c}
        </button>
      ))}

      {customValue && !other && (
        <button type="button" onClick={() => onChange(null)} className={chip(true)}>
          {customValue} ✕
        </button>
      )}

      {other ? (
        <input
          type="text"
          autoFocus
          value={customValue ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              onChange(null);
              setOther(false);
            }
          }}
          placeholder="Client name"
          className="w-32 rounded-full border border-border bg-surface px-2.5 py-0.5 text-xs text-text"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            onChange(null);
            setOther(true);
          }}
          className={chip(false)}
        >
          + Other
        </button>
      )}
    </div>
  );
}
