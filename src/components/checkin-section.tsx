"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { OWNERS } from "@/lib/team";
import { upsertCheckin } from "@/lib/daily-actions";
import type { DailyCheckin } from "@/lib/daily";
import type { TeamMember } from "@/lib/database.types";
import { SectionShell } from "./section-shell";

// One row per team member for the selected day. The current user's row is
// inline-editable (upsert on save); everyone else's row is read-only.
export function CheckinSection({
  checkins,
  date,
  currentMember
}: {
  checkins: DailyCheckin[];
  date: string;
  currentMember: TeamMember | null;
}) {
  const byMember = new Map(checkins.map((c) => [c.member, c]));
  const filled = checkins.filter((c) => c.mood && c.mood.trim()).length;

  return (
    <SectionShell title="Check-in" count={filled} countLabel={`of ${OWNERS.length} in`}>
      <div className="divide-y divide-border/50">
        {OWNERS.map((member) => (
          <CheckinRow
            key={member}
            member={member}
            checkin={byMember.get(member) ?? null}
            date={date}
            editable={member === currentMember}
          />
        ))}
      </div>
    </SectionShell>
  );
}

function CheckinRow({
  member,
  checkin,
  date,
  editable
}: {
  member: TeamMember;
  checkin: DailyCheckin | null;
  date: string;
  editable: boolean;
}) {
  const [draft, setDraft] = useState(checkin?.mood ?? "");
  const [pending, startTransition] = useTransition();
  const mood = checkin?.mood ?? "";
  const dirty = draft.trim() !== mood.trim();

  const save = () => {
    if (!dirty) return;
    startTransition(() => upsertCheckin({ checkin_date: date, member, mood: draft }));
  };

  return (
    <div className="flex items-center gap-3 px-5 py-2.5">
      <span className="w-16 flex-shrink-0 text-sm font-semibold text-text">{member}</span>
      {editable ? (
        <>
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
            }}
            placeholder="How are you doing today?"
            className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1 text-sm text-text focus:border-accent/50 focus:outline-none"
          />
          <button
            type="button"
            onClick={save}
            disabled={pending || !dirty}
            className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-text-inverse hover:bg-accent-strong disabled:opacity-50"
          >
            Save
          </button>
        </>
      ) : (
        <span
          className={cn(
            "min-w-0 flex-1 px-2 py-1 text-sm",
            mood ? "text-text" : "italic text-text-muted"
          )}
        >
          {mood || "—"}
        </span>
      )}
    </div>
  );
}
