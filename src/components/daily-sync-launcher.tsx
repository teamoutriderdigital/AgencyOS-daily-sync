"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Entry point to the daily sync from the dashboard: start today's standup, or
// open (and thereby start) any specific day's sync.
export function DailySyncLauncher({ today }: { today: string }) {
  const router = useRouter();
  const [date, setDate] = useState(today);

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-accent/30 bg-accent/5 p-5 shadow-sm">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight text-text">Daily sync</h2>
        <p className="mt-0.5 text-sm text-text-muted">
          Run the standup — check-in, client headlines, IDS, and to-dos.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => router.push("/daily")}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-text-inverse hover:bg-accent-strong"
        >
          + Start today&apos;s sync
        </button>
        <span className="text-xs text-text-muted">or open a day</span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text"
        />
        <button
          type="button"
          onClick={() => router.push(`/daily?date=${date}`)}
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text hover:bg-surface-alt"
        >
          Open
        </button>
      </div>
    </div>
  );
}
