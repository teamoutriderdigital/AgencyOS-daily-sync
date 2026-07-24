import type { OpsStatus, Tables } from "./database.types";

export type OpsTask = Tables<"ops_tasks">;

// Status lifecycle. "Done" is the only closed state; everything else is open.
export const OPS_STATUSES: OpsStatus[] = ["Open", "In progress", "Blocked", "Done"];

export function isOpenOpsTask(task: OpsTask): boolean {
  return task.status !== "Done";
}

// Colored pill per status — Blocked red so it reads as needing attention.
export function getOpsStatusClasses(status: OpsStatus): string {
  switch (status) {
    case "Open":
      return "border-slate-200 bg-slate-50 text-slate-700";
    case "In progress":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "Blocked":
      return "border-red-200 bg-red-50 text-red-700";
    case "Done":
      return "border-green-200 bg-green-50 text-green-700";
  }
}
