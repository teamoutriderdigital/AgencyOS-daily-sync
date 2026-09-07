# L10 board refresh — 7 September 2026

Kas’s 31 August feedback: update daily, use understandable titles, show one row per subproject with its latest or overdue task, make deadlines consistent, and keep backlog in Plane.

## Result

- Weekly L10 (current week), Dashboard and today’s Daily Sync use the same live client-work table. Past daily notes are preserved. Past weeks do not pretend that current Plane status is a historical snapshot.
- One row per client and subproject, including one task, its owner, status, deadline and a direct Plane link. Website design/development/launch phases collapse into Website; content production/publishing collapse into SEO and content.
- The oldest overdue active task wins. If none is overdue, the latest updated active task wins. Missing dates and owners are explicit; no dates are invented.
- Plane backlog, completed, cancelled, archived and draft work is excluded. Blocked and approval work stays visible while active. Age alone never silently removes work.
- Open IDS and meeting commitments from past weeks appear in the current week automatically. The weekly sync is no longer needed just to make unfinished work visible.
- Eleven legacy IDS titles have reviewed, readable display names. The underlying notes and original titles remain intact. In particular, “Security/access is 0/32…” displays as “Finish and share the security setup skill.”
- The legacy board backlog remains in Admin for migration/reference. Each IDS topic has a “Keep in Plane, remove from L10” form. It verifies that an existing linked item is backlog or closed before archiving the meeting topic; it preserves the discussion and link without stamping a completion date.

## Daily operation

Plane is the source of current task status: owners update their tasks there. There is no longer a daily headline-copy step for the client table. Opening the board loads current source data; while visible, the view checks every 15 minutes and when reopened. Successful source reads are cached for five minutes, and simultaneous requests share a refresh. This is refresh-on-use, not a scheduled job that writes meeting notes while the board is closed.

The displayed check time is the time of the snapshot, in Bogotá. Failed refreshes show an error. Tasks with no module (including inherited parent module) remain under “Other active work,” with a grouping notice. Client projects are explicitly linked in `src/lib/subprojects.ts`; unknown clients are flagged, not silently omitted.

## Source cleanup still visible

The live verification produced 22 rows across nine linked clients. Key Healthcare has no corresponding project in the current mapping/project list. Some active tasks lack modules, owners or dates. These remain visible for source cleanup; old tasks are not automatically declared complete or moved to backlog based on age. No Plane tasks were modified by this implementation.

## Runtime / release

Requires Node 22 for the installed Supabase client. Set server-only `PLANE_API_KEY` and the existing `SITE_PASSWORD` on the correct deployment. Never use a `NEXT_PUBLIC_` variable for the Plane credential. The new API and retention action reject unauthenticated requests, including when SITE_PASSWORD is missing. Workspace is fixed to `project-ares` and API host to Plane Cloud.

No database migration is needed. The app uses Plane’s [work-items API](https://developers.plane.so/api-reference/issue/overview), follows cursor pagination, and resolves unexpanded state/assignee IDs from reference lists.

Production is `agency-os-daily-sync.vercel.app`. The local Vercel link points to a different project according to NEXTSTEPS.md: do not deploy through that link. This change has been prepared and tested locally, not deployed.

## Validation

Run with Node 22:

```sh
npm run typecheck
npm run lint
node --test tests/*.test.cjs
npm run build
```

Tests cover grouping, date selection, excluded states, active blockers, missing metadata, parent cycles, Bogotá date boundaries, and the authenticated Plane-retention safeguards. Browser verification covers the authenticated live client table and readable IDS title. An unauthenticated client-work API request returns 401.
