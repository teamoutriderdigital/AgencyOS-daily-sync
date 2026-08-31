import type { Tables } from "./database.types";

export type StrategyMeeting = Tables<"strategy_meetings">;
export type StrategyActionItem = Tables<"strategy_actions">;

// ─── Month helpers ──────────────────────────────────────────────────────────
// A "month" is always its first day as yyyy-mm-01, mirroring how the daily
// tables key on yyyy-mm-dd. Parse as local date parts to avoid the
// UTC-midnight off-by-one (same reasoning as shiftISODate in daily.ts).

export function currentMonthISO(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString("en-CA");
}

export function shiftMonth(month: string, months: number): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1 + months, 1).toLocaleDateString("en-CA");
}

export function formatMonthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
