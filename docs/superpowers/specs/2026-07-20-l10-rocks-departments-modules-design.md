# L10 Weekly Board — Rocks Restructure, Departments & New Modules

**Date:** 2026-07-20
**Scope:** The weekly L10 board (`/weekly`) in `daily-sync-board`.
**Status:** Design approved in brainstorming; pending spec review.

## Context

The weekly L10 board renders Rocks → Client stages → IDS → To-dos → Rating.
Rocks are flat (`title, owner, rock_type, smart, deadline, status, quarter`),
grouped by owner. IDS issues carry a `client_internal` string array but no
department and no link to a rock. There is no completed-list, innovation, or
backlog concept.

This build makes the weekly meeting move faster and reflect reality:

1. Re-seed rocks from the current (Q3 2026) team list and show each rock's
   progress note (`1/7`, `0/32`, …).
2. Add an **Admin / Growth / Internal** department dimension across rocks, IDS,
   and to-dos, and let the board group by it.
3. Reconcile ("clean") the IDS list against the rocks — dedupe, tag by
   department, and link rock-work issues to their rock.
4. Add three momentum modules: **Completed since last meeting**, **Innovation**,
   **Backlog**.
5. Add **AI summaries per recurring item**, generated from Fathom transcripts,
   and auto-feed Fathom-flagged items into the backlog.

## Principles (do not relitigate)

- **Additive only.** One migration + one section component per feature, matching
  the existing pattern (migrations `001`–`011`, one `*-section.tsx` each). No
  rewrites of Rocks/IDS/To-dos.
- **Shared master state.** Rocks, IDS, and to-dos stay single-source, realtime,
  shown on both `/daily` and `/weekly`. New per-item fields (department,
  `rock_id`, `completed_at`) are columns on those same tables, not new copies.
- **Rocks stay flat.** No sub-task table. Progress is a text note badge.
- **Phased.** Each phase ships independently. Phase 1 is the foundation the rest
  groups by.

---

## Phase 1 — Structure (rocks, departments, IDS cleanup)

### 1.1 Schema — migration `012_departments.sql`

```sql
-- Department taxonomy shared by rocks, issues, and to-dos.
do $$ begin
  create type department as enum ('Admin', 'Growth', 'Internal');
exception when duplicate_object then null; end $$;

alter table rocks        add column if not exists department department;
alter table rocks        add column if not exists progress_note text;   -- "1/7", "0/32"
alter table ids_items    add column if not exists department department;
alter table ids_items    add column if not exists rock_id integer references rocks(id) on delete set null;
alter table action_items add column if not exists department department;

-- Completed-since-last-meeting needs a real completion timestamp (done/archived
-- flags don't record WHEN). Backfill nulls; app stamps it on the done/solve action.
alter table action_items add column if not exists completed_at timestamptz;
alter table ids_items    add column if not exists completed_at timestamptz;

create index if not exists ids_items_rock_idx on ids_items(rock_id);
```

`department` is **nullable** — an untagged item still renders (in an "Unassigned"
group) so nothing disappears mid-migration. `rock_id` is nullable and
`on delete set null` so deleting a rock never deletes its issues.

### 1.2 Re-seed rocks (data)

The `rocks` table currently holds the July "Finalize & Assign" seed, now stale.
Replace `SEED_ROCKS` in `src/lib/rocks.ts` with the current list below (adds
`department` + `progress_note`), and re-seed. Because rocks may already carry
live status edits, re-seeding is a **guarded reset-and-insert** run once from the
Rocks board (`/rocks`), not a blind migration insert. `ROCK_OWNERS` already
covers these names.

**Department mapping (approved):**

| Dept | Owner | Rock | Progress | Status |
|---|---|---|---|---|
| Admin | Daniel | Email templates | 1/7 | On track |
| Admin | Daniel | Meeting flows / templates | 2/9 | On track |
| Admin | Daniel | Onboarding end-to-end + team wiki | 0/8 | On track |
| Admin | Daniel | Single-owner accountability map for ops | 3/6 | On track |
| Admin | Jack | Legal / compliance / contracts | 0/6 | On track |
| Growth | Jack | Lead Gen — AgencyOS (high-ticket) | 1/5 | On track |
| Growth | Jack | Lead Gen — Heavy Duty Leads | 0/6 | On track |
| Growth | Jack | Verticalization playbook | 0/4 | On track |
| Growth | Jack | Customer-experience journey | 1/5 | On track |
| Growth | Jack | Add Google Ads business with Daniel UK | 0/1 | On track |
| Internal | Daniel | Plane / PM — self-host on Ares + AgencyOS integration | 1/9 | On track |
| Internal | Leo | Data Architecture Map | 0/4 | On track |
| Internal | Leo | Data is #1 — per-client BigQuery + Plane + Obsidian | 0/5 | On track |
| Internal | Leo | Workflows + SOPs + audit build + client data | 0/5 | On track |
| Internal | Leo | Build 4-5 internal sites (with Mostafa) | 0/1 | On track |
| Internal | Leo | UX / user-journey skill in Claude (with Mostafa) | 0/1 | On track |
| Internal | Rehan | Security / access (repos, Vercel, VPS doc hosting) | 0/32 | On track |
| Internal | Rehan | Code review workflows | 0/17 | On track |
| Internal | Rehan | G-Suite multi-domain | 1/1 | **Done** |
| Internal | Kas | Internal Dashboard / AgencyOS | 0/11 | On track |
| Internal | Kas | Client Dashboard | 0/7 | On track |
| Internal | Kas | Audit / Offer / Proposal full system | 0/5 | On track |

**Known collision to resolve live (not auto-decided):** "Customer-experience
journey" appears under both Jack (Growth, 1/5) and Daniel-with-Leo (0/1). The
seed keeps Jack's as the rock and drops Daniel's duplicate; if the room wants
Daniel/Leo to own a distinct slice, split it live. No co-ownership.

### 1.3 Clean the IDS against the rocks

Reconciliation is a Phase-1 task, executed against the **live** `ids_items` at
implementation time (this list is the target state, derived from the rocks and
the open loops recorded in `rocks.ts`):

1. **Read** all open `ids_items`.
2. **Archive execution detail** — any "issue" that is really rock progress or a
   to-do (e.g. "build X", "finish Y") is archived; that work lives on the rock or
   in to-dos, not IDS. IDS holds **decisions and cross-cutting blockers** only.
3. **Merge duplicates** into the canonical issues below.
4. **Tag** every surviving issue with a `department` and, where it is rock-work,
   a `rock_id`.

**Proposed cleaned IDS (canonical set):**

| Issue | Dept | Owner | Linked rock | Priority |
|---|---|---|---|---|
| CX journey has two owners (Jack vs Daniel/Leo) — collapse to one rock, one owner | Growth | Jack | CX journey | High |
| Data governance must land before dependent Internal rocks ("data first") — sequence it | Internal | Leo | Data Architecture Map | High |
| Security/access is 0/32 — scope the 32 into a datable sprint or it never closes | Internal | Rehan | Security / access | High |
| Onboarding seam: Daniel owns the mechanism, Kas's audit consumes it — confirm boundary | Admin | Daniel | Onboarding + wiki | Medium |
| Dashboard boundary: Leo infra/vault · Kas client surface · Daniel account data — ratify | Internal | Kas | Internal / Client Dashboard | Medium |
| Plane: self-host on Ares vs status quo — confirm before AgencyOS integration build | Internal | Daniel | Plane self-host | Medium |
| CRM: Attio vs Twenty both still live — pick one | Growth | Jack | — | Medium |
| Google Ads UK entity with Daniel — go/no-go + who owns compliance | Growth | Jack | Google Ads business | Low |

The spec ships this as the **proposed** target; the room confirms archives/merges
before they are applied (a dry-run summary is printed, not silently executed).

### 1.4 UI — department grouping

- **`department.ts`** lib: `DEPARTMENTS = ['Admin','Growth','Internal']` + badge
  color classes (mirroring `getPriorityClasses`).
- **`RocksTrackerSection`**: outer grouping by department (Admin → Growth →
  Internal → Unassigned), owner as the inner grouping it already does. Each rock
  card shows a `progress_note` badge (e.g. `3/6`). Per-department "% On Track".
- **`IdsSection`** and **`ActionItemsSection`**: a department column + a
  group-by-department toggle. IDS rows linked to a rock show the rock title as a
  chip.
- Add/edit forms for all three gain a **Department** select; IDS add/edit gains a
  **Rock** picker (optional). Written through the existing
  `create*/update*` actions (extend the `*Input` types with `department` /
  `rock_id`).

---

## Phase 2 — Momentum modules

### 2.1 Completed since last meeting

Read-only. Lists rocks/IDS/to-dos whose `completed_at` (or rock `status = Done`)
falls within the selected ISO week — the "done column" for momentum. No new
table: it's a derived view over the three existing tables. `completed_at` is
stamped by extending `toggleActionItemDone`, the IDS solve action, and
`setRockStatus` to write `now()` when an item transitions to done/solved/Done
(and `null` when reopened). Grouped by department. New `CompletedSection`,
rendered directly under Rocks.

### 2.2 Innovation — migration `013_innovations.sql`

```sql
create table if not exists innovations (
  id serial primary key,
  title text not null default '',
  url text,
  found_by text,                 -- free text, same roster width as rocks
  note text,
  department department,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- open RLS + realtime + touch_updated_at trigger, same shape as 003.
```

New `InnovationSection` (add/edit/delete inline, `useTransition` + realtime
channel, mirroring `HeadlinesSection`). The slot for new tools/discoveries
(Mobbin, etc.).

### 2.3 Backlog — migration `014_backlog.sql`

```sql
do $$ begin
  create type backlog_source as enum ('manual', 'fathom');
exception when duplicate_object then null; end $$;

create table if not exists backlog_items (
  id serial primary key,
  title text not null default '',
  detail text,
  department department,
  source backlog_source not null default 'manual',
  source_ref text,               -- Fathom recording_id / URL when source='fathom'
  reviewed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- open RLS + realtime + touch trigger.
```

New `BacklogSection`: future-client ideas + Fathom-flagged items. A "reviewed"
toggle and a filter default to unreviewed so the ~2×/month triage shows only
what's new. Manual add inline; `source='fathom'` rows arrive via Phase 3.

---

## Phase 3 — AI summaries & Fathom-fed backlog

### 3.1 Per-item AI summary — migration `015_item_summaries.sql`

```sql
create table if not exists item_summaries (
  id serial primary key,
  item_type text not null,       -- 'rock' | 'ids'
  item_id integer not null,
  week_number integer not null,
  year_number integer not null,
  summary text not null,
  source_ref text,               -- Fathom recording_id(s) used
  created_at timestamptz not null default now(),
  unique (item_type, item_id, week_number, year_number)
);
```

A server action `generateItemSummaries(year, week)`:

1. Pulls the relevant Fathom transcript(s) for the period via the Fathom MCP
   (`list_meetings` → `get_meeting_transcript`).
2. For each recurring rock and carried-over IDS issue, asks Claude for a 1–2 line
   recap of what was last said about it.
3. Upserts into `item_summaries` keyed by (item, week). Cached — regenerating a
   week is idempotent; the meeting opens with context already written.

Rock cards and IDS rows render their summary inline (muted, collapsible) when one
exists for the selected week. A "↻ Refresh summaries" button on the board
triggers regeneration.

**Dependency:** requires an authenticated Fathom connector and a Claude API key
in the deployment env. If either is absent, the section degrades to "no summaries
yet" rather than erroring (same defensive pattern as `meeting_ratings`).

### 3.2 Fathom-flagged → backlog

`generateItemSummaries` (or a sibling action) also scans the transcript for
flagged/parking-lot items ("let's put that in the backlog", future-client ideas)
and inserts them into `backlog_items` with `source='fathom'`,
`source_ref=<recording_id>`, `reviewed=false`. Dedupe on `source_ref` + title so
re-running a week never double-inserts.

---

## Board section order (`/weekly`) after all phases

1. Rocks (grouped by department → owner, progress badges, inline AI summaries)
2. Completed since last meeting
3. Client stages *(unchanged)*
4. IDS (grouped by department, rock chips, inline AI summaries)
5. To-dos (grouped by department)
6. Innovation
7. Backlog
8. Meeting rating *(unchanged)*

## Migrations added

`012_departments.sql`, `013_innovations.sql`, `014_backlog.sql`,
`015_item_summaries.sql`. Each idempotent, open RLS, added to
`supabase_realtime`, matching the `003` template.

## Acceptance criteria

**Phase 1**
- [ ] `012_departments.sql` runs clean and is idempotent.
- [ ] Rocks re-seeded to the 22-row list above with correct department +
      progress note; G-Suite shows Done.
- [ ] Weekly Rocks section groups Admin → Growth → Internal, owner inside, with a
      progress badge per rock and per-department % On Track.
- [ ] IDS + To-dos carry a department and can be grouped by it; IDS rows can link
      to a rock and show its chip.
- [ ] IDS reconciliation produces the canonical 8-issue set; a dry-run summary of
      archives/merges is shown before anything is applied.

**Phase 2**
- [ ] `completed_at` is stamped on done/solve/Done and cleared on reopen.
- [ ] "Completed since last meeting" lists exactly the items closed in the
      selected ISO week, grouped by department.
- [ ] Innovation and Backlog sections add/edit/delete inline and sync in realtime
      across two windows within ~2s.
- [ ] Backlog defaults to showing unreviewed items; the reviewed toggle persists.

**Phase 3**
- [ ] `generateItemSummaries` writes one cached summary per recurring item per
      week; re-running is idempotent.
- [ ] Rock cards / IDS rows show their summary inline when present.
- [ ] Fathom-flagged items land in Backlog with `source='fathom'`, deduped.
- [ ] Missing Fathom/Claude credentials degrade gracefully (no board blank-out).

## Out of scope

- Rock sub-tasks (rocks stay flat by decision).
- Client-facing surfaces (this is the internal L10 board).
- Backfilling `completed_at` for historically-done items (only new transitions
  are stamped; the completed list is empty for past weeks until items close).
