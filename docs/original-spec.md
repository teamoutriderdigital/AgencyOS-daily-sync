# GrowthArchon — Daily Sync Board Build

## Context

This builds a live daily standup board for the internal Outrider + AgencyOS team. It is the daily counterpart to the weekly L10 module already in GrowthArchon. It bolts onto the existing dashboard (Next.js 14, Supabase, Vercel, GitHub). Internal team only, not client-facing.

The format is the weekly L10 stripped to what moves every day: a check-in, client headlines, issue-solving (IDS), and to-dos. Scorecard, Rocks, and the meeting rating are deliberately not here. They stay in the weekly `/l10`.

## The one rule that drives the whole architecture

To-dos and IDS are **not new data**. They read and write the **same tables the weekly L10 already uses** (`action_items` and `ids_items`, or whatever the L10 module actually named them). One source of truth, two views. An issue solved on the daily board disappears from the weekly L10 because it is the same row.

Only the check-in and client headlines are daily-specific. Those get two small new tables, scoped by date.

## Architecture decision (already made, do not relitigate)

- Two new per-day tables: `daily_checkins`, `daily_headlines`. Both date-scoped and ephemeral.
- Reuse the existing L10 tables for to-dos and issues. No new tables for these.
- One route, `/daily`, date-aware: defaults to today, with a date picker to view past days.
- Real-time via Supabase channels, identical pattern to `/l10`.
- Internal-only access, same guard as `/l10`.

## Step 1 — Inspect existing conventions first (before writing any code)

Read the existing L10 module and the repo to learn, do not assume:

1. The exact table and column names for the L10 to-dos and issues. Confirm from the migration or schema, not from memory. This build writes to those tables directly.
2. The Supabase client setup pattern (`lib/supabase` or similar).
3. The real-time channel pattern the L10 page uses (`supabase.channel(...).on('postgres_changes', ...)`).
4. The internal-access guard the L10 route uses. Reuse it verbatim.
5. The inline-edit, add-modal, and archive/mark-done components the L10 sections use. Reuse them so the daily board looks and behaves like the weekly one.
6. The auth/team pattern for owner and assignee (`auth.users`, a `profiles` table, etc). Match it for `user_id`, `owner`, `created_by`.

If the L10 module is not yet merged when this runs, stop and flag it. This build depends on those tables existing.

## Step 2 — Schema (new tables only)

Create one migration, `supabase/migrations/<date>_daily_sync.sql`, matching the L10 migration's conventions and RLS.

`daily_checkins`
- `id` (pk)
- `checkin_date` (date)
- `user_id` (matches the L10 auth pattern)
- `mood` (text — the one-line "how are you doing")
- `created_at`, `updated_at`
- Unique on (`checkin_date`, `user_id`). Editing a check-in upserts, it does not insert a duplicate.

`daily_headlines`
- `id` (pk)
- `headline_date` (date)
- `client` (match the L10's client field exactly — same type and FK if the L10 uses one)
- `text` (text, one line)
- `created_by`
- `created_at`, `updated_at`

RLS: internal team read/write only, same policy shape as the L10 tables.

## Step 3 — Route and layout (`/daily`)

- Date header at the top: shows the selected date, defaults to today, with prev/next arrows and a date picker.
- Four section cards rendered in agenda order: Check-in, Client headlines, IDS, To-dos.
- Each card carries the L10 module's look.

### Check-in
- One row per team member for the selected date, showing their one-line note.
- The current user's row is inline-editable with a Save button. Saving upserts `daily_checkins` for the selected date. Other members' rows are read-only.
- Empty state for the current user: an "Add check-in" affordance. Only the current user can add or edit their own.

### Client headlines
- List of headlines for the selected date.
- "Add" button opens an inline row: client + one-line text.
- Each row has edit (pencil) and delete (trash) buttons.
- Keep it to one line per headline. This is news, not discussion.

### IDS (issues)
- Reads the existing L10 issues table, filtered to open (`archived = false`).
- "Add" button: Issue (required), Owner, Priority. Reuse the L10 add-modal.
- Inline edit. A "Solved" button archives the row (`archived = true`), the same mechanic as the L10. Solving here removes it from the weekly L10 too. That is intended.
- A "Route to L10" affordance for an issue too big to solve in a daily: set the L10's existing flag/priority/tag field if one exists; otherwise prepend a marker in the description. Do not invent a parallel field.

### To-dos
- Reads the existing L10 action-items table, filtered to open (`archived = false`).
- "Add" button and inline edit, reusing the L10 components.
- The add/edit form must let the user set three things, mapped to the **existing** columns on the L10 action-items table. Do not create new columns for these:
  - **Assignee** — a person picker. Populate it from the same team/auth source the L10 uses (the `profiles` / team-members list, not a free-text field). Writes to the existing owner/assignee column.
  - **Due date** — a date picker. Writes to the existing due-date column.
  - **Urgency** — a select. This is the L10's existing **Priority** field, not a new one. Read the allowed values from the L10 schema (e.g. Low / Medium / High) and reuse them exactly. If you are tempted to add an `urgency` column, stop: it must be the same column the weekly L10 sorts on, or the two views diverge.
- A "Done" button completes/archives per the L10 convention. Completing here updates the weekly L10.
- Visually mark items due today or overdue, and surface urgency (e.g. a colored dot or tag from the Priority value).

## Step 4 — Real-time

- All four sections subscribe to their tables via `supabase.channel`, same as `/l10`. Two members in the board during the sync see each other's edits within ~2 seconds.
- For `daily_checkins` and `daily_headlines`, filter to the selected date (server-side in the channel filter if practical, otherwise client-side).

## Step 5 — Agenda order config

Render the four sections from a single constant:

```ts
const AGENDA_ORDER = ['checkin', 'headlines', 'ids', 'todos'] as const;
```

Current team order is IDS before to-dos. The standard L10 runs to-dos before IDS so that slipped commitments become issues. Flipping the order is a one-line change to this constant. Leave a comment to that effect.

## Out of scope (do not build)

- Scorecard, Rocks, and the 1-10 meeting rating. Those live in the weekly `/l10` and have no daily equivalent.
- The client-facing Gantt / roadmap. That is a separate client artifact, not part of this internal board.
- New tables for to-dos or issues. Reuse the L10 tables. This is the core rule of the build.
- Per-day snapshots or audit trail for to-dos and issues. They are shared live state with the L10, not daily records.

## Acceptance criteria

- [ ] `supabase/migrations/<date>_daily_sync.sql` runs clean.
- [ ] `/daily` renders today by default; the date picker moves between days.
- [ ] Check-in: the current user can add and edit their own one-liner (upsert); other members are read-only.
- [ ] Client headlines: add, edit, and delete inline, scoped to the selected date.
- [ ] IDS reads the same issues table as `/l10`; solving an issue here removes it from `/l10`.
- [ ] To-dos read the same action-items table as `/l10`; completing one here updates `/l10`.
- [ ] Adding a to-do lets the user pick an assignee (from the team list), a due date, and an urgency, and all three write to the existing L10 columns; the new item then appears in the weekly `/l10` with those same values.
- [ ] Two browser windows on `/daily` see each other's edits within ~2 seconds.
- [ ] Non-internal users cannot access `/daily`, same as `/l10`.

## Trigger prompt

> Read `growtharchon-daily-sync-board.md` and execute. Start with Step 1. Do not write any code until you have confirmed the real table and column names for the L10 to-dos and issues, and reuse those tables.
