"use client";

import { useTransition } from "react";
import { cn } from "@/lib/utils";
import { OWNERS } from "@/lib/team";
import { setAttendance } from "@/lib/daily-actions";
import { ATTENDANCE_STATUSES, attendanceClasses, type DailyCheckin } from "@/lib/daily";
import type { AttendanceStatus, TeamMember } from "@/lib/database.types";
import { SectionShell } from "./section-shell";

// Attendance for the day: mark each member Present / Remote / Out with one
// click. Anyone can set it (handy for whoever runs the standup). The header
// counts how many are attending (Present or Remote).
export function CheckinSection({ checkins, date }: { checkins: DailyCheckin[]; date: string }) {
  const byMember = new Map(checkins.map((c) => [c.member, c.status]));
  const present = OWNERS.filter((m) => byMember.get(m) === "Present").length;

  return (
    <SectionShell title="Check-in" count={present} countLabel={`of ${OWNERS.length} in`}>
      <div className="divide-y divide-border/50">
        {OWNERS.map((member) => (
          <CheckinRow key={member} member={member} status={byMember.get(member) ?? null} date={date} />
        ))}
      </div>
    </SectionShell>
  );
}

function CheckinRow({
  member,
  status,
  date
}: {
  member: TeamMember;
  status: AttendanceStatus | null;
  date: string;
}) {
  const [pending, startTransition] = useTransition();

  const set = (next: AttendanceStatus) => {
    // Clicking the active status again clears it (back to unmarked).
    const value = status === next ? null : next;
    startTransition(() => setAttendance({ checkin_date: date, member, status: value }));
  };

  return (
    <div className="flex items-center gap-3 px-5 py-2.5">
      <span className="w-20 flex-shrink-0 text-sm font-semibold text-text">{member}</span>
      <div className={cn("flex gap-1.5", pending && "opacity-60")}>
        {ATTENDANCE_STATUSES.map((s) => {
          const active = status === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => set(s)}
              aria-pressed={active}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                attendanceClasses(s, active)
              )}
            >
              {s}
            </button>
          );
        })}
      </div>
      {!status && <span className="text-xs italic text-text-muted">not marked</span>}
    </div>
  );
}
