# Daily Sync Board

A live daily standup board for the internal team — the daily counterpart to the
weekly L10. Four sections in agenda order: **Check-in → Client headlines → IDS
(issues) → To-dos**. Date-aware (defaults to today, with a date picker for past
days) and realtime (two people in the board see each other's edits within ~2s).

Built with Next.js 14 (App Router) + Supabase. **Standalone** — it does not
depend on the GrowthArchon dashboard.

## How this differs from the spec

The original spec assumed this would bolt onto the GrowthArchon dashboard and
**reuse the weekly L10's `action_items` / `ids_items` tables** as one source of
truth. As a standalone app there is no shared database, so this version carries
its **own** `action_items` and `ids_items` tables. To-dos and issues live only
in this app; they do not sync to a weekly L10.

There is also **no auth** (the spec reused the dashboard's admin guard, which
doesn't exist here). Instead:

- You pick **"I am: …"** in the header (stored in `localStorage`). That drives
  which check-in row is editable and who authors headlines.
- RLS is **permissive** (the anon key can read/write). **Protect access at the
  deployment layer** — e.g. Vercel password protection or a private network.
  To lock it down properly later, swap the permissive policies in the migration
  for a real auth check.

## Setup

1. **Install**
   ```bash
   npm install
   ```

2. **Create a Supabase project**, then run the migration in the SQL editor (or
   via the Supabase CLI):
   ```
   supabase/migrations/001_daily_sync.sql
   ```
   Make sure Realtime is enabled for the project (the migration adds the four
   tables to the `supabase_realtime` publication).

3. **Environment** — copy `.env.example` to `.env.local` and fill in:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```

4. **Run**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000 — it redirects to `/daily`.

## Notes

- **Agenda order** is a single constant in `src/lib/daily.ts` (`AGENDA_ORDER`).
  The team currently runs IDS before to-dos; the standard L10 runs to-dos first
  so slipped commitments become issues. Flipping it is a one-line swap.
- **"Solved"** on an issue archives it (sets `archived = true`) and removes it
  from the open list.
- **To-dos** carry over day to day until marked done (toggle "Show done" to see
  completed items). They are not date-scoped — only check-ins and headlines are.

## Scripts

- `npm run dev` — dev server
- `npm run build` / `npm run start` — production build
- `npm run lint` — ESLint
- `npm run typecheck` — `tsc --noEmit`

## Current L10 client work

The Weekly L10, Dashboard and today’s Daily Sync show compact **Client work**
rows — one per client subproject, with the oldest overdue task (or else the
latest active one), its owner and its deadline.

**The deployment never talks to Plane.** The rows are computed on a machine that
has the credentials and pushed into the `plane_subprojects` table; the site only
reads that table. So no Plane API key belongs on Vercel — only `SITE_PASSWORD`.

Refresh the snapshot before a meeting:

```bash
npm run push:client-work -- --dry   # show what would be pushed
npm run push:client-work            # push it; open boards update live
npm run push:client-work -- --replace   # rewrite a day already seeded
```

It writes two things: the `plane_subprojects` snapshot, and the **client cards**
the meeting reads — one card per client with a plain-English headline and a tick
list of action items, in the same `daily_headlines` / `headline_tasks` shape
every previous daily sync and L10 has used. A day that already has cards is left
alone unless `--replace` is passed, so a push can never wipe ticks mid-meeting.

It needs `PLANE_API_KEY` and the Supabase URL/anon key in `.env.local`, and
migration `027_plane_subprojects.sql` applied. A client Plane cannot be read for
is reported as a warning on the board rather than silently losing its rows, and
a push that reads nothing at all leaves the previous snapshot in place.

How every line on the board is worded — titles, owners, dates, and how gaps are
stated — is written down in [How things are named on the board](docs/board-naming.md),
checked beside the text box as you type, and auditable across everything already
on the board with `npm run audit:naming`.
See [L10 board refresh](docs/l10-board-refresh.md) for selection rules, source
cleanup and release requirements.
