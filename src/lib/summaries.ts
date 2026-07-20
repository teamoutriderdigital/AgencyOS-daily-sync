import type { Tables } from "./database.types";

export type ItemSummary = Tables<"item_summaries">;

// Stable key so a rock card / IDS row can find its summary in O(1).
export function summaryKey(itemType: "rock" | "ids", itemId: number): string {
  return `${itemType}:${itemId}`;
}

export function indexSummaries(rows: ItemSummary[]): Map<string, ItemSummary> {
  const m = new Map<string, ItemSummary>();
  for (const r of rows) m.set(summaryKey(r.item_type as "rock" | "ids", r.item_id), r);
  return m;
}
