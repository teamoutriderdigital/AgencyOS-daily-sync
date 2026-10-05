import type { TeamMember } from "./database.types";

// The internal team. Owner/assignee/check-in identity all draw from this list
// (matches the team_member enum in the migration). Edit here + the enum to add
// a member.
// Leonardo and Lianna left the team; they stay in the team_member enum so old
// rows still read, but they are off every picker and out of the meeting rating
// count.
export const OWNERS: TeamMember[] = ["Jack", "Daniel", "Rehan", "Kas", "Rasika", "Mubshar", "Anna"];
