"use client";

import { cn } from "@/lib/utils";
import { CHECKLIST } from "@/lib/rocks";

// "Don't leave without these" — the exit gate. Each box is shared meeting state
// (kv key), so a tick shows for everyone. The bar fills as the room closes items.
export function RockChecklist({
  checked,
  onToggle
}: {
  checked: (key: string) => boolean;
  onToggle: (key: string, next: boolean) => void;
}) {
  const done = CHECKLIST.filter((c) => checked(c.key)).length;
  const pct = Math.round((done / CHECKLIST.length) * 100);

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <h2 className="font-display text-base font-semibold tracking-tight text-text">
          Don&apos;t leave without these
        </h2>
        <span className="text-xs text-text-muted">the meeting isn&apos;t over until the bar fills</span>
      </div>

      <div className="flex items-center gap-3 px-5 py-4">
        <div className="h-2.5 flex-1 overflow-hidden rounded-full border border-border bg-surface-alt">
          <div
            className="h-full rounded-full bg-green-500 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="whitespace-nowrap font-display text-sm font-semibold tabular-nums text-text">
          {done} / {CHECKLIST.length}
        </span>
      </div>

      <ul className="divide-y divide-border/50">
        {CHECKLIST.map((c) => {
          const isDone = checked(c.key);
          return (
            <li key={c.key}>
              <label className="flex cursor-pointer items-start gap-3 px-5 py-2.5">
                <input
                  type="checkbox"
                  checked={isDone}
                  onChange={(e) => onToggle(c.key, e.target.checked)}
                  className="mt-0.5 h-4 w-4 flex-shrink-0 accent-green-600"
                />
                <span className={cn("text-sm", isDone ? "text-text-muted line-through" : "text-text")}>
                  {c.label}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
