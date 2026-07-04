import type { ClientStage, Tables } from "./database.types";

export type Client = Tables<"clients">;

// Lifecycle stages, in pipeline order. Renaming a stage means editing this list
// AND the client_stage enum in migration 006.
export const CLIENT_STAGES: ClientStage[] = [
  "Onboarding",
  "Active",
  "At Risk",
  "Delivered",
  "Churned"
];

// Badge colors per stage. "At Risk" is the one that should catch the eye.
export function clientStageClasses(stage: ClientStage): string {
  switch (stage) {
    case "Onboarding":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "Active":
      return "border-green-200 bg-green-50 text-green-700";
    case "At Risk":
      return "border-red-200 bg-red-50 text-red-700";
    case "Delivered":
      return "border-indigo-200 bg-indigo-50 text-indigo-700";
    case "Churned":
      return "border-border bg-surface-alt text-text-muted";
  }
}
