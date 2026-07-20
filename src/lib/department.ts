import type { Department } from "./database.types";

// Admin / Growth / Internal — the department dimension shared by rocks, IDS,
// and to-dos on the weekly L10 board. Order is meeting order.
export const DEPARTMENTS: Department[] = ["Admin", "Growth", "Internal"];

export function getDepartmentClasses(d: Department | null): string {
  switch (d) {
    case "Admin":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "Growth":
      return "bg-purple-50 text-purple-700 border-purple-200";
    case "Internal":
      return "bg-amber-50 text-amber-700 border-amber-200";
    default:
      return "bg-surface-alt text-text-muted border-border";
  }
}

// Group items into department buckets in the canonical order, appending an
// "Unassigned" bucket last. Empty buckets are dropped so the UI stays tight.
export function groupByDepartment<T>(
  items: T[],
  get: (t: T) => Department | null
): { department: Department | "Unassigned"; items: T[] }[] {
  const buckets = new Map<Department | "Unassigned", T[]>();
  for (const it of items) {
    const key = get(it) ?? "Unassigned";
    const list = buckets.get(key) ?? [];
    list.push(it);
    buckets.set(key, list);
  }
  const ordered: (Department | "Unassigned")[] = [...DEPARTMENTS, "Unassigned"];
  return ordered
    .filter((d) => buckets.has(d))
    .map((d) => ({ department: d, items: buckets.get(d) ?? [] }));
}
