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
