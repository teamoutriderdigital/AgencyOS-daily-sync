// Reviewed titles for the legacy L10 topics. Match the full old text so a later
// human edit is never replaced by a stale alias. Context stays in IDS notes.
export const BOARD_TITLES: Record<string, string> = {
  'Security/access is 0/32 — scope the 32 into a datable sprint or it never closes': 'Finish and share the security setup skill',
  'Departing-contractor asset + access continuity — no offboarding SOP': 'Create the employee offboarding checklist',
  'Project EROS — go/no-go + who owns compliance': 'Decide whether to proceed with Project Eros and who owns compliance',
  'Theraplay: zero Plane movement in 16 days (79 open, 32 overdue, 53 unassigned) — Darko is back today, set the reboot plan': 'Unblock Theraplay access and agree who leads the work',
  "Mubshar's rocks — he has none; bring 2–3 'big needle mover' ideas to define for the remaining 6 weeks": "Agree Mubshar’s quarterly priorities",
  'GA4 / analytics best-practice checklist across every client (incl. PostHog) — Rehan builds the skill from the COD setup, Mubshar executes; Jack wants it by end of September': 'Create and roll out the client analytics checklist',
  'Full social fortress setup for AgencyOS': 'Launch the Faber House website and social profiles',
  'What is going on with accesses? Whats plan with github, vercel, etc?': 'Agree who owns our GitHub, Vercel and hosting accounts',
  "Lianna's rocks — general ones assigned; refine with her own ideas this week": "Agree Lianna’s quarterly priorities",
  'Plane: self-host on Ares vs status quo — confirm before AgencyOS integration build': 'Confirm where Plane will be hosted',
  'Faber House: one brand, one back-end — Daniel drafts the switchover plan (client-facing emails/accounts, unified back-end), Jack reviews; Rasika + Jack own branding + site': 'Plan the move to Faber House and shared AgencyOS accounts'
};
export function boardTitle(title: string): string { return BOARD_TITLES[title] ?? title; }
