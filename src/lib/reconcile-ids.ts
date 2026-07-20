import type { Department, L10Priority, TeamMember } from "./database.types";

// The cleaned IDS: decisions and cross-cutting blockers only. Execution detail
// belongs on rocks / to-dos, not here. rockTitle links the issue to its rock.
export const CANONICAL_IDS: {
  issue: string;
  department: Department;
  owner: TeamMember;
  rockTitle: string | null;
  priority: L10Priority;
}[] = [
  { issue: "CX journey has two owners (Jack vs Daniel/Leo) — collapse to one rock, one owner", department: "Growth", owner: "Jack", rockTitle: "Customer-experience journey", priority: "High" },
  { issue: "Data governance must land before dependent Internal rocks (\"data first\") — sequence it", department: "Internal", owner: "Leonardo", rockTitle: "Data Architecture Map", priority: "High" },
  { issue: "Security/access is 0/32 — scope the 32 into a datable sprint or it never closes", department: "Internal", owner: "Rehan", rockTitle: "Security / access (repos, Vercel, VPS doc hosting)", priority: "High" },
  { issue: "Onboarding seam: Daniel owns the mechanism, Kas's audit consumes it — confirm boundary", department: "Admin", owner: "Daniel", rockTitle: "Onboarding end-to-end + team wiki", priority: "Medium" },
  { issue: "Dashboard boundary: Leo infra/vault · Kas client surface · Daniel account data — ratify", department: "Internal", owner: "Kas", rockTitle: "Client Dashboard", priority: "Medium" },
  { issue: "Plane: self-host on Ares vs status quo — confirm before AgencyOS integration build", department: "Internal", owner: "Daniel", rockTitle: "Plane / PM — self-host on Ares + AgencyOS integration", priority: "Medium" },
  { issue: "CRM: Attio vs Twenty both still live — pick one", department: "Growth", owner: "Jack", rockTitle: null, priority: "Medium" },
  { issue: "Google Ads UK entity with Daniel — go/no-go + who owns compliance", department: "Growth", owner: "Jack", rockTitle: "Add Google Ads business with Daniel UK", priority: "Low" }
];
