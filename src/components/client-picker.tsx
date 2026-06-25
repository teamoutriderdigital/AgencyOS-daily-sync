"use client";

import { useState } from "react";
import { CLIENTS } from "@/lib/daily";

// Client selector for headlines: shows the default clients (Redstone, SBD, COD,
// Vital) in a dropdown, plus "+ Add new…" which flips to a text input for any
// other client. An existing custom value is preserved as its own option.
export function ClientPicker({
  value,
  onChange,
  className
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  className?: string;
}) {
  const [adding, setAdding] = useState(false);

  if (adding) {
    return (
      <input
        type="text"
        autoFocus
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            onChange(null);
            setAdding(false);
          }
        }}
        placeholder="New client name"
        className={className}
      />
    );
  }

  return (
    <select
      value={value ?? ""}
      onChange={(e) => {
        const v = e.target.value;
        if (v === "__add__") {
          onChange(null);
          setAdding(true);
          return;
        }
        onChange(v || null);
      }}
      className={className}
    >
      <option value="">— client —</option>
      {CLIENTS.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
      {value && !CLIENTS.includes(value) && <option value={value}>{value}</option>}
      <option value="__add__">+ Add new…</option>
    </select>
  );
}
