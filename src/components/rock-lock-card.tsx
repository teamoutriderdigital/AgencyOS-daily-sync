"use client";

import { cn } from "@/lib/utils";

// A decision / collision card with a "lock" mechanic. The top content differs
// per card (passed as children); this shell owns the recommendation line and the
// write-a-call + lock row shared by both. Locked → the whole card turns green.
export function RockLockCard({
  accent,
  locked,
  recommend,
  lockLabel,
  placeholder,
  defaultText,
  onCommitText,
  onToggleLock,
  children
}: {
  accent: "warn" | "flag";
  locked: boolean;
  recommend: string;
  lockLabel: string;
  placeholder: string;
  defaultText: string;
  onCommitText: (value: string) => void;
  onToggleLock: (next: boolean) => void;
  children: React.ReactNode;
}) {
  const leftBorder = locked
    ? "border-l-green-500"
    : accent === "warn"
      ? "border-l-amber-400"
      : "border-l-red-400";

  return (
    <div
      className={cn(
        "rounded-2xl border border-border border-l-4 bg-surface p-4 shadow-sm transition-colors sm:p-5",
        leftBorder,
        locked && "bg-green-50/60"
      )}
    >
      {children}

      <p className="mt-3 rounded-lg border border-dashed border-border bg-surface-alt px-3 py-2 text-sm text-text">
        <span className="mr-1.5 text-xs font-semibold uppercase tracking-wide text-accent">Recommend</span>
        {recommend}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "whitespace-nowrap text-xs font-semibold uppercase tracking-wide",
            locked ? "text-green-700" : "text-text-muted"
          )}
        >
          {lockLabel}
        </span>
        <input
          type="text"
          defaultValue={defaultText}
          placeholder={placeholder}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v !== defaultText.trim()) onCommitText(v);
          }}
          className="min-w-[12rem] flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          onClick={() => onToggleLock(!locked)}
          className={cn(
            "rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide text-text-inverse transition-colors",
            locked ? "bg-green-600 hover:bg-green-700" : "bg-text hover:bg-black"
          )}
        >
          {locked ? "Locked ✓" : "Lock"}
        </button>
      </div>
    </div>
  );
}
