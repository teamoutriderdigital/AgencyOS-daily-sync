"use client";

import { useTransition } from "react";
import { cn } from "@/lib/utils";
import { OWNERS } from "@/lib/team";
import { setMeetingRating } from "@/lib/daily-actions";
import type { MeetingRating } from "@/lib/daily";
import type { TeamMember } from "@/lib/database.types";
import { SectionShell } from "./section-shell";

const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

// Meeting rating — the L10 close-out. Each member rates the meeting 1–10; the
// header shows how many have rated and the running average. Anyone can set a
// score (handy for whoever runs the standup). Date-scoped, one row per member.
export function RatingSection({ ratings, date }: { ratings: MeetingRating[]; date: string }) {
  const byMember = new Map(ratings.map((r) => [r.member, r.rating]));
  const given = OWNERS.map((m) => byMember.get(m)).filter((v): v is number => v != null);
  const avg = given.length ? given.reduce((a, b) => a + b, 0) / given.length : null;

  return (
    <SectionShell
      title="Meeting rating"
      count={given.length}
      countLabel={`of ${OWNERS.length} rated`}
      rightSlot={
        <span
          className={cn(
            "rounded-full border px-3 py-1 text-sm font-semibold",
            avg == null
              ? "border-border bg-surface text-text-muted"
              : avg >= 8
                ? "border-green-200 bg-green-50 text-green-700"
                : avg >= 6
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : "border-red-200 bg-red-50 text-red-700"
          )}
          title="Average rating"
        >
          {avg == null ? "— avg" : `${avg.toFixed(1)} avg`}
        </span>
      }
    >
      <div className="divide-y divide-border/50">
        {OWNERS.map((member) => (
          <RatingRow key={member} member={member} score={byMember.get(member) ?? null} date={date} />
        ))}
      </div>
    </SectionShell>
  );
}

function RatingRow({
  member,
  score,
  date
}: {
  member: TeamMember;
  score: number | null;
  date: string;
}) {
  const [pending, startTransition] = useTransition();

  const set = (next: number) => {
    // Clicking the current score again clears it.
    const value = score === next ? null : next;
    startTransition(() => setMeetingRating({ rating_date: date, member, rating: value }));
  };

  return (
    <div className="flex items-center gap-3 px-5 py-2.5">
      <span className="w-20 flex-shrink-0 text-sm font-semibold text-text">{member}</span>
      <div className={cn("flex flex-wrap gap-1", pending && "opacity-60")}>
        {SCORES.map((s) => {
          const active = score === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => set(s)}
              aria-pressed={active}
              className={cn(
                "h-7 w-7 rounded-md border text-xs font-semibold transition-colors",
                active
                  ? "border-accent bg-accent text-text-inverse"
                  : "border-border bg-surface text-text-muted hover:border-accent/50 hover:text-accent"
              )}
            >
              {s}
            </button>
          );
        })}
      </div>
      {score == null && <span className="text-xs italic text-text-muted">not rated</span>}
    </div>
  );
}
