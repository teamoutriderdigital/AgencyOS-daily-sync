import type { SalesStage, Tables } from "./database.types";

export type SalesDeal = Tables<"sales_deals">;

// Pipeline stages in progression order. Won/Lost are terminal — a deal in
// either is "closed" and drops out of the open pipeline count.
export const SALES_STAGES: SalesStage[] = ["Lead", "Proposal", "Verbal", "Won", "Lost"];

export const CLOSED_STAGES: SalesStage[] = ["Won", "Lost"];

export function isOpenDeal(deal: SalesDeal): boolean {
  return !CLOSED_STAGES.includes(deal.stage);
}

// How far out the "closing soon" filter looks.
export const CLOSING_SOON_DAYS = 30;

// Today as a YYYY-MM-DD string. expected_close is a bare `date` column, so
// comparing strings avoids timezone drift that Date parsing would introduce.
export function todayIso(): string {
  return new Date().toLocaleDateString("en-CA");
}

// Deliberately no lower bound: a deal whose close date has already passed still
// counts as closing soon, so one that slipped stays visible instead of dropping
// out of the very view meant to catch it. Deals without a date never match here.
export function isClosingSoonByDate(deal: SalesDeal, today: string): boolean {
  if (!deal.expected_close) return false;
  const cutoff = new Date(`${today}T00:00:00`);
  cutoff.setDate(cutoff.getDate() + CLOSING_SOON_DAYS);
  return deal.expected_close <= cutoff.toLocaleDateString("en-CA");
}

// Two routes into the closing-soon view, because the team has two kinds of
// knowledge: the `closing_soon` flag ("we think this lands soon") and an actual
// expected_close inside the window ("we know when"). Either qualifies — a
// flagged deal doesn't need a date, and a dated deal doesn't need flagging.
export function isClosingSoon(deal: SalesDeal, today: string): boolean {
  return deal.closing_soon || isClosingSoonByDate(deal, today);
}

export function isOverdue(deal: SalesDeal, today: string): boolean {
  return Boolean(deal.expected_close && deal.expected_close < today);
}

// Colored pill per stage — warms up as the deal advances; Won green, Lost red.
export function getStageClasses(stage: SalesStage): string {
  switch (stage) {
    case "Lead":
      return "border-slate-200 bg-slate-50 text-slate-700";
    case "Proposal":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "Verbal":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "Won":
      return "border-green-200 bg-green-50 text-green-700";
    case "Lost":
      return "border-red-200 bg-red-50 text-red-700";
  }
}

// Compact currency, e.g. 12000 → "$12,000". Null/blank shows as an em dash.
export function formatValue(value: number | null): string {
  if (value == null) return "—";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  });
}
