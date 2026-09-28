import type { Tables } from "./database.types";

// Last full week's client numbers, as pushed by scripts/push-client-metrics.py.
// This module is pure (no React, no Supabase) so the pusher, the board and
// tests/client-metrics.test.cjs all share one set of rules.
export type ClientMetric = Tables<"client_metrics">;

export type MetricKey = "organic_clicks" | "impressions" | "sessions" | "key_events" | "revenue";
export type ThroughKey = "organic_through" | "traffic_through" | "revenue_through";

export type MetricColumn = {
  key: MetricKey;
  prevKey: `${MetricKey}_prev`;
  label: string;
  money?: boolean;
  // Which "data through" date this column depends on, and what to call the
  // source when the week had to be cut short.
  throughKey: ThroughKey;
  sourceLabel: string;
};

// Column order on the board and in the agenda table. Every metric here is one
// where up is good, which is what deltaTone assumes.
export const METRIC_COLUMNS: MetricColumn[] = [
  { key: "organic_clicks", prevKey: "organic_clicks_prev", label: "Organic clicks", throughKey: "organic_through", sourceLabel: "Search Console" },
  { key: "impressions", prevKey: "impressions_prev", label: "Impressions", throughKey: "organic_through", sourceLabel: "Search Console" },
  { key: "sessions", prevKey: "sessions_prev", label: "Sessions", throughKey: "traffic_through", sourceLabel: "Analytics" },
  { key: "key_events", prevKey: "key_events_prev", label: "Key events", throughKey: "traffic_through", sourceLabel: "Analytics" },
  { key: "revenue", prevKey: "revenue_prev", label: "Revenue", money: true, throughKey: "revenue_through", sourceLabel: "Revenue" }
];

// PostgREST can hand a numeric column back as a string; normalise once here.
export function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function fmtMetric(col: Pick<MetricColumn, "money">, value: number): string {
  const rounded = Math.round(value);
  const text = rounded.toLocaleString("en-US");
  return col.money ? `$${text}` : text;
}

// "+21%", "-16%", "no change", "new" (from nothing), or "" when there is no
// previous week to compare against.
export function deltaLabel(now: number | null, prev: number | null): string {
  if (now == null || prev == null) return "";
  if (prev === 0) return now === 0 ? "no change" : "new";
  const pct = Math.round(((now - prev) / prev) * 100);
  if (pct === 0) return "no change";
  return `${pct > 0 ? "+" : "-"}${Math.abs(pct)}%`;
}

export type DeltaTone = "up" | "down" | "flat" | "none";

export function deltaTone(now: number | null, prev: number | null): DeltaTone {
  if (now == null || prev == null) return "none";
  if (now === prev) return "flat";
  return now > prev ? "up" : "down";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parts(iso: string): { day: number; month: number; weekday: number } {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return { day: d.getUTCDate(), month: d.getUTCMonth(), weekday: d.getUTCDay() };
}

// "Sat 19 Sep"
export function formatDay(iso: string): string {
  const p = parts(iso);
  return `${DAYS[p.weekday]} ${p.day} ${MONTHS[p.month]}`;
}

// "14–20 Sep", or "28 Sep – 4 Oct" when the week crosses a month.
export function weekLabel(startIso: string, endIso: string): string {
  const a = parts(startIso);
  const b = parts(endIso);
  if (a.month === b.month) return `${a.day}–${b.day} ${MONTHS[a.month]}`;
  return `${a.day} ${MONTHS[a.month]} – ${b.day} ${MONTHS[b.month]}`;
}

// Only the most recent week that has been pushed. The board never mixes weeks.
export function latestWeek(rows: ClientMetric[]): ClientMetric[] {
  if (rows.length === 0) return [];
  const max = rows.reduce((m, r) => (r.week_start > m ? r.week_start : m), rows[0].week_start);
  return rows.filter((r) => r.week_start === max);
}

// Each client's newest week that has numbers. Sources recover at different
// times (one client's feed can stall while another's is current), so the
// table shows every client as fresh as it can be rather than holding them all
// back to the slowest. `behind` explains a row older than the headline week.
export type ShownMetric = { row: ClientMetric; behind: string | null };

export function latestPerClient(rows: ClientMetric[]): { headline: ClientMetric | null; shown: ShownMetric[] } {
  const headlineRows = latestWeek(rows);
  const headline = headlineRows[0] ?? null;
  if (!headline) return { headline: null, shown: [] };
  const byClient = new Map<string, ClientMetric[]>();
  for (const r of rows) byClient.set(r.client, [...(byClient.get(r.client) ?? []), r]);
  const shown: ShownMetric[] = [];
  for (const [, list] of byClient) {
    const sorted = [...list].sort((a, b) => b.week_start.localeCompare(a.week_start));
    const newest = sorted[0];
    const withData = sorted.find(hasData);
    if (!withData || withData.week_start === newest.week_start) {
      shown.push({ row: newest, behind: null });
      continue;
    }
    const reason = newest.note ? `${newest.note.replace(/, too little of the week to show/g, "")}` : "no data yet";
    shown.push({
      row: withData,
      behind: `Showing ${weekLabel(withData.week_start, withData.week_end)}, the newest complete week. ${weekLabel(newest.week_start, newest.week_end)}: ${reason}.`
    });
  }
  return { headline, shown };
}

// Same order as the clients table; clients not on it (TPP today) follow, by
// the pusher's sort_order, then name.
export function orderRows(rows: ClientMetric[], clientOrder: string[]): ClientMetric[] {
  const rank = new Map(clientOrder.map((name, i) => [name.toLowerCase(), i]));
  const key = (r: ClientMetric) => rank.get(r.client.toLowerCase()) ?? clientOrder.length + r.sort_order;
  return [...rows].sort((a, b) => key(a) - key(b) || a.client.localeCompare(b.client));
}

export function hasData(row: ClientMetric): boolean {
  return METRIC_COLUMNS.some((c) => num(row[c.key]) != null);
}

export function splitConnected(rows: ClientMetric[]): { connected: ClientMetric[]; notConnected: ClientMetric[] } {
  return {
    connected: rows.filter(hasData),
    notConnected: rows.filter((r) => !hasData(r))
  };
}

// One line per source whose data stopped before the week ended, e.g.
// "Search Console through Sat 19 Sep, both weeks cut to match". Empty when the
// week is complete for every connected source.
export function throughNotes(row: ClientMetric): string[] {
  const seen = new Set<ThroughKey>();
  const out: string[] = [];
  for (const col of METRIC_COLUMNS) {
    if (seen.has(col.throughKey) || num(row[col.key]) == null) continue;
    seen.add(col.throughKey);
    const through = row[col.throughKey];
    if (through && through.slice(0, 10) < row.week_end.slice(0, 10)) {
      out.push(`${col.sourceLabel} through ${formatDay(through)}, both weeks cut to match`);
    }
  }
  return out;
}

// One row as a markdown table line, for the L10 agenda.
export function metricToMarkdown(row: ClientMetric): string {
  const cells = METRIC_COLUMNS.map((c) => {
    const now = num(row[c.key]);
    if (now == null) return "—";
    const delta = deltaLabel(now, num(row[c.prevKey]));
    return delta ? `${fmtMetric(c, now)} (${delta})` : fmtMetric(c, now);
  });
  return `| ${row.client} | ${cells.join(" | ")} |`;
}

// ─── Trend line under each client ────────────────────────────────────────────
// One or two plain sentences on the last six weeks of organic clicks (sessions
// when a client has no Search Console), built from the weekly rows the pusher
// writes. Each week's change is its own like-for-like cut, so a short week
// compares with the same days the week before.

const ORDINALS = ["", "", "second", "third", "fourth", "fifth", "sixth"];
// Below this, a percentage is noise ("up 100%" from 1 click to 2), so the line
// gives the counts instead.
const SMALL = 20;
// A week has to move at least this much to be called out as the biggest move.
const NOTABLE_PCT = 10;

type TrendWeek = { label: string; value: number; prev: number; pct: number | null };

function pct(now: number, prev: number): number | null {
  if (prev === 0) return null;
  return Math.round(((now - prev) / prev) * 100);
}

export function clientTrend(rows: ClientMetric[], client: string, maxWeeks = 6): string | null {
  const mine = rows
    .filter((r) => r.client === client)
    .sort((a, b) => a.week_start.localeCompare(b.week_start));
  const useClicks = mine.some((r) => num(r.organic_clicks) != null);
  const key: MetricKey = useClicks ? "organic_clicks" : "sessions";
  const noun = useClicks ? "Organic clicks" : "Sessions";
  const weeks: TrendWeek[] = mine
    .filter((r) => num(r[key]) != null && num(r[`${key}_prev`]) != null)
    .slice(-maxWeeks)
    .map((r) => {
      const value = num(r[key]) as number;
      const prev = num(r[`${key}_prev`]) as number;
      return { label: weekLabel(r.week_start, r.week_end), value, prev, pct: pct(value, prev) };
    });
  if (weeks.length === 0) return null;

  const last = weeks[weeks.length - 1];
  const count = (n: number) => Math.round(n).toLocaleString("en-US");
  if (last.value < SMALL && last.prev < SMALL) {
    return `${noun} are still small: ${count(last.value)} in ${last.label}, ${count(last.prev)} the week before.`;
  }

  const sign = (w: TrendWeek) => (w.pct == null ? 0 : Math.sign(w.pct));
  const rising = (w: TrendWeek) =>
    w.pct == null || w.pct === 0 ? "holding level" : `${w.pct > 0 ? "rising" : "falling"} ${Math.abs(w.pct)}%`;
  const moved = (w: TrendWeek) => (w.pct == null || w.pct === 0 ? "held level" : `${w.pct > 0 ? "rose" : "fell"} ${Math.abs(w.pct)}%`);

  let first: string;
  if (last.pct == null) {
    first = `${noun} came back in ${last.label}, ${count(last.value)} after none the week before.`;
  } else if (last.pct === 0) {
    first = `${noun} held level in ${last.label}, at ${count(last.value)}.`;
  } else {
    let streak = 1;
    for (let i = weeks.length - 2; i >= 0 && sign(weeks[i]) === sign(last); i--) streak++;
    const before = weeks.length > 1 ? weeks[weeks.length - 2] : null;
    const tail =
      streak >= 2
        ? `, the ${ORDINALS[Math.min(streak, 6)]} ${last.pct > 0 ? "rise" : "drop"} in a row`
        : before
          ? `, after ${rising(before)} the week before`
          : "";
    first = `${noun} ${moved(last)} in ${last.label}, to ${count(last.value)}${tail}.`;
  }

  const others = weeks.slice(0, -1).filter((w) => w.pct != null && Math.abs(w.pct) >= NOTABLE_PCT);
  if (others.length === 0) return first;
  const biggest = others.reduce((m, w) => (Math.abs(w.pct as number) > Math.abs(m.pct as number) ? w : m));
  if (Math.abs(biggest.pct as number) <= Math.abs(last.pct ?? 0)) return first;
  const span = weeks.length;
  return `${first} The biggest move of the last ${span} weeks was ${biggest.label}, ${(biggest.pct as number) > 0 ? "up" : "down"} ${Math.abs(biggest.pct as number)}%.`;
}
