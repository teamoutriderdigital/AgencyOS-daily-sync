import type { AttendanceStatus, Tables } from "./database.types";

export type DailyCheckin = Tables<"daily_checkins">;
export type DailyHeadline = Tables<"daily_headlines">;

// Attendance options for the daily check-in. "Present" and "Remote" both count
// as attending; "Out" does not.
export const ATTENDANCE_STATUSES: AttendanceStatus[] = ["Present", "Remote", "Out"];

export function attendanceClasses(status: AttendanceStatus, active: boolean): string {
  if (!active) return "border-border bg-surface text-text-muted hover:bg-surface-alt";
  switch (status) {
    case "Present":
      return "border-green-200 bg-green-50 text-green-700";
    case "Remote":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "Out":
      return "border-red-200 bg-red-50 text-red-700";
  }
}

// ─── Agenda order ───────────────────────────────────────────────────────────
// The four daily sections render from this single constant. The current team
// order is IDS before to-dos. The standard L10 runs to-dos before IDS so that
// slipped commitments become issues — flipping the order is a one-line change
// here (swap "ids" and "todos").
export const AGENDA_ORDER = ["checkin", "headlines", "ids", "todos"] as const;
export type AgendaSection = (typeof AGENDA_ORDER)[number];

// ─── Date helpers ───────────────────────────────────────────────────────────

export function shiftISODate(iso: string, days: number): string {
  // Parse as local date parts to avoid the UTC-midnight off-by-one that
  // `new Date("yyyy-mm-dd")` introduces.
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return dt.toLocaleDateString("en-CA");
}

export function formatLongDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}
