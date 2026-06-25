import type { Tables } from "./database.types";
import type { IdsStatus, L10Priority } from "./database.types";

export type ActionItem = Tables<"action_items">;
export type IdsItem = Tables<"ids_items">;

export const L10_PRIORITIES: L10Priority[] = ["High", "Medium", "Low"];
export const IDS_STATUSES: IdsStatus[] = ["Not started", "Block", "In progress", "Solved"];

// ─── Badge color helpers ────────────────────────────────────────────────────

export function getIdsStatusClasses(status: IdsStatus): string {
  switch (status) {
    case "Solved":
      return "bg-green-50 text-green-700 border-green-200";
    case "In progress":
      return "bg-yellow-50 text-yellow-700 border-yellow-200";
    case "Block":
      return "bg-red-50 text-red-700 border-red-200";
    case "Not started":
      return "bg-surface-alt text-text-muted border-border";
  }
}

export function getPriorityClasses(priority: L10Priority | null): string {
  switch (priority) {
    case "High":
      return "bg-red-50 text-red-700 border-red-200";
    case "Medium":
      return "bg-yellow-50 text-yellow-700 border-yellow-200";
    case "Low":
      return "bg-surface-alt text-text-muted border-border";
    default:
      return "bg-surface-alt text-text-muted border-border";
  }
}

// ─── Date helper ────────────────────────────────────────────────────────────
// Local-date string (yyyy-mm-dd via en-CA) so date columns line up regardless
// of timezone.
export function todayLocalISO(): string {
  return new Date().toLocaleDateString("en-CA");
}
