// ISO-week helpers for the weekly L10 board. ISO 8601: weeks start Monday, and
// week 1 is the week containing the first Thursday of the year — so the ISO year
// can differ from the calendar year at boundaries. All math is done in UTC to
// avoid the timezone off-by-one that local Date parsing introduces.

export type IsoWeek = { year: number; week: number };

// The ISO (year, week) for a given date's UTC day.
export function isoWeekOf(date: Date): IsoWeek {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = (d.getUTCDay() + 6) % 7; // Mon = 0 … Sun = 6
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // shift to the Thursday of this week
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const ftDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - ftDay + 3);
  const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / 604_800_000);
  return { year: d.getUTCFullYear(), week };
}

// This week, from the local "today" (mapped onto its UTC day).
export function currentIsoWeek(): IsoWeek {
  const now = new Date();
  return isoWeekOf(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
}

// Monday (UTC) that starts a given ISO week.
export function isoWeekStart(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = (jan4.getUTCDay() + 6) % 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Day);
  const monday = new Date(week1Monday);
  monday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  return monday;
}

// "Week 27, 2026"
export function isoWeekLabel({ year, week }: IsoWeek): string {
  return `Week ${week}, ${year}`;
}

// Human date range for the week header, e.g. "Jun 29 – Jul 5".
export function isoWeekRangeLabel({ year, week }: IsoWeek): string {
  const start = isoWeekStart(year, week);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${fmt(start)} – ${fmt(end)}`;
}

// Step forward/back by whole weeks, returning the resulting ISO (year, week).
export function shiftIsoWeek({ year, week }: IsoWeek, deltaWeeks: number): IsoWeek {
  const monday = isoWeekStart(year, week);
  monday.setUTCDate(monday.getUTCDate() + deltaWeeks * 7);
  return isoWeekOf(monday);
}

// Does an item (with its stamped week/year) belong to the selected week? Legacy
// rows with a null week are treated as "current week" so nothing disappears
// before the first carryover sync stamps them.
export function itemInWeek(
  item: { week_number: number | null; year_number: number | null },
  target: IsoWeek,
  current: IsoWeek
): boolean {
  if (item.week_number == null || item.year_number == null) {
    return target.year === current.year && target.week === current.week;
  }
  return item.year_number === target.year && item.week_number === target.week;
}
