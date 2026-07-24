import type { SalesStage, Tables } from "./database.types";

export type SalesDeal = Tables<"sales_deals">;

// Pipeline stages in progression order. Won/Lost are terminal — a deal in
// either is "closed" and drops out of the open pipeline count.
export const SALES_STAGES: SalesStage[] = ["Lead", "Proposal", "Verbal", "Won", "Lost"];

export const CLOSED_STAGES: SalesStage[] = ["Won", "Lost"];

export function isOpenDeal(deal: SalesDeal): boolean {
  return !CLOSED_STAGES.includes(deal.stage);
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
