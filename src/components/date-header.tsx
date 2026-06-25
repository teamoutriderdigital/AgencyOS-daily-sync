"use client";

import { OWNERS } from "@/lib/team";
import { formatLongDate, shiftISODate } from "@/lib/daily";
import type { TeamMember } from "@/lib/database.types";

// Date control + "who am I" selector for the daily board. The member selector
// stands in for auth (this is an internal tool with no login) — it drives which
// check-in row is editable and who authors headlines.
export function DateHeader({
  date,
  today,
  onSelect,
  currentMember,
  onMemberChange
}: {
  date: string;
  today: string;
  onSelect: (date: string) => void;
  currentMember: TeamMember | null;
  onMemberChange: (member: TeamMember | null) => void;
}) {
  const isToday = date === today;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onSelect(shiftISODate(date, -1))}
          className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-text-muted hover:bg-surface-alt hover:text-text"
          aria-label="Previous day"
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => onSelect(shiftISODate(date, 1))}
          disabled={isToday}
          className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-text-muted hover:bg-surface-alt hover:text-text disabled:opacity-40"
          aria-label="Next day"
        >
          →
        </button>
      </div>

      <h1 className="font-display text-2xl font-semibold tracking-tight text-text">
        {formatLongDate(date)}
      </h1>

      <input
        type="date"
        value={date}
        max={today}
        onChange={(e) => {
          if (e.target.value) onSelect(e.target.value);
        }}
        className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-text"
      />

      {!isToday && (
        <>
          <span className="rounded-full border border-yellow-200 bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-700">
            Viewing a past day
          </span>
          <button
            type="button"
            onClick={() => onSelect(today)}
            className="rounded-md px-2 py-1 text-xs font-medium text-accent hover:underline"
          >
            Back to today
          </button>
        </>
      )}

      <label className="ml-auto flex items-center gap-2 text-xs text-text-muted">
        I am
        <select
          value={currentMember ?? ""}
          onChange={(e) => onMemberChange((e.target.value as TeamMember) || null)}
          className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-text"
        >
          <option value="">— pick —</option>
          {OWNERS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
