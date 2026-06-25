import type { TeamMember } from "./database.types";

// The internal team. Owner/assignee/check-in identity all draw from this list
// (matches the team_member enum in the migration). Edit here + the enum to add
// a member.
export const OWNERS: TeamMember[] = ["Jack", "Daniel", "Leonardo", "Rehan", "Kas"];
