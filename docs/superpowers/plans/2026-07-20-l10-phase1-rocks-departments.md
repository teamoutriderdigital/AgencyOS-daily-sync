# L10 Phase 1 — Rocks Re-seed, Departments & IDS Cleanup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Admin/Growth/Internal department dimension to rocks, IDS, and to-dos; re-seed rocks from the current Q3 2026 team list with progress notes; and reconcile the live IDS list against the rocks — without removing client headlines or IDS.

**Architecture:** Purely additive. One SQL migration adds a `department` enum plus nullable columns to the three existing master tables. TypeScript types, a small `department` lib, server-action inputs, and the three weekly-board sections are extended to read/write and group by department. Re-seed and IDS reconciliation are guarded, operator-triggered server actions that print a dry-run before mutating live data.

**Tech Stack:** Next.js 14 (app router, server actions), Supabase (Postgres + Realtime), TypeScript, Tailwind. No test framework — verification is `npm run typecheck`, `npm run lint`, `npm run build`, and manual two-window checks. Migrations are applied by pasting SQL into the Supabase SQL editor.

## Global Constraints

- **Additive only.** Do not rewrite Rocks/IDS/To-dos or remove client headlines. `department`, `rock_id`, `progress_note`, `completed_at` are new nullable columns on existing tables — never new copy tables.
- **Enum name:** `department` with exactly three values `'Admin'`, `'Growth'`, `'Internal'` (this order).
- **Migrations are idempotent** (guarded `do $$ … exception when duplicate_object then null … $$`, `add column if not exists`), open RLS, added to `supabase_realtime` — matching `supabase/migrations/003_rocks_meeting.sql`.
- **Owner fields stay free text** on rocks (roster wider than the `team_member` enum). `ids_items.owner` / `action_items.assignee` stay the `TeamMember` enum.
- **Live-data actions are guarded.** Re-seed and IDS reconciliation must support a `dryRun` that returns a plan and mutates nothing; the caller confirms before a real run.
- **No new deploy or migration is run by the implementer.** The plan produces the SQL + code; the operator (Daniel) runs the migration and the guarded actions.

---

### Task 1: Migration `012_departments.sql`

**Files:**
- Create: `supabase/migrations/012_departments.sql`

**Interfaces:**
- Produces: `department` enum type; columns `rocks.department`, `rocks.progress_note`, `ids_items.department`, `ids_items.rock_id`, `ids_items.completed_at`, `action_items.department`, `action_items.completed_at`; index `ids_items_rock_idx`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/012_departments.sql`:

```sql
-- Department dimension (Admin / Growth / Internal) for the weekly L10 board.
--
-- Additive to the existing master tables — rocks, ids_items, action_items —
-- so the daily and weekly boards keep reading the same rows. Also adds:
--   • rocks.progress_note   — free-text "1/7", "0/32" shown as a badge.
--   • ids_items.rock_id      — link an issue to the rock it belongs to.
--   • *.completed_at         — real completion timestamp for the weekly
--                              "Completed since last meeting" list (done/archived
--                              flags don't record WHEN).
-- All columns nullable so existing rows render unchanged. Idempotent.

do $$ begin
  create type department as enum ('Admin', 'Growth', 'Internal');
exception when duplicate_object then null; end $$;

alter table rocks        add column if not exists department    department;
alter table rocks        add column if not exists progress_note text;
alter table ids_items    add column if not exists department    department;
alter table ids_items    add column if not exists rock_id       integer references rocks(id) on delete set null;
alter table ids_items    add column if not exists completed_at  timestamptz;
alter table action_items add column if not exists department    department;
alter table action_items add column if not exists completed_at  timestamptz;

create index if not exists ids_items_rock_idx on ids_items(rock_id);
```

- [ ] **Step 2: Verify idempotency & shape by inspection**

Re-read the file. Confirm: enum guarded by `exception when duplicate_object`; every `alter` uses `if not exists`; `rock_id` is `on delete set null`; no `not null` on any new column. (No DB run here — the operator applies it in Task 9.)

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/012_departments.sql
git commit -m "feat(db): add department dimension + progress/rock_id/completed_at columns"
```

---

### Task 2: Extend `database.types.ts`

**Files:**
- Modify: `src/lib/database.types.ts` (add `Department` type near line 10; extend `rocks`, `ids_items`, `action_items` Row blocks)

**Interfaces:**
- Consumes: enum + columns from Task 1.
- Produces: `export type Department = "Admin" | "Growth" | "Internal";` and the new optional fields on the three Row types, so all downstream code typechecks.

- [ ] **Step 1: Add the `Department` type**

After the `RockStatus` line (currently line 9) add:

```ts
export type Department = "Admin" | "Growth" | "Internal";
```

- [ ] **Step 2: Extend the three Row types**

In `action_items.Row` add:
```ts
          department: Department | null;
          completed_at: string | null;
```
In `ids_items.Row` add:
```ts
          department: Department | null;
          rock_id: number | null;
          completed_at: string | null;
```
In `rocks.Row` add:
```ts
          department: Department | null;
          progress_note: string | null;
```
(The `Insert`/`Update` types are `Partial<…Row>`, so they pick these up automatically.)

- [ ] **Step 3: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS (no errors). Existing code doesn't yet reference the new fields, so nothing breaks.

- [ ] **Step 4: Commit**

```bash
git add src/lib/database.types.ts
git commit -m "feat(types): add Department + new rock/ids/action columns"
```

---

### Task 3: `department` lib (constants, colors, grouping)

**Files:**
- Create: `src/lib/department.ts`

**Interfaces:**
- Consumes: `Department` from `database.types`.
- Produces:
  - `DEPARTMENTS: Department[]` = `["Admin", "Growth", "Internal"]`
  - `getDepartmentClasses(d: Department | null): string`
  - `groupByDepartment<T>(items: T[], get: (t: T) => Department | null): { department: Department | "Unassigned"; items: T[] }[]` — ordered Admin → Growth → Internal → Unassigned, skipping empty groups.

- [ ] **Step 1: Write the lib**

Create `src/lib/department.ts`:

```ts
import type { Department } from "./database.types";

// Admin / Growth / Internal — the department dimension shared by rocks, IDS,
// and to-dos on the weekly L10 board. Order is meeting order.
export const DEPARTMENTS: Department[] = ["Admin", "Growth", "Internal"];

export function getDepartmentClasses(d: Department | null): string {
  switch (d) {
    case "Admin":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "Growth":
      return "bg-purple-50 text-purple-700 border-purple-200";
    case "Internal":
      return "bg-amber-50 text-amber-700 border-amber-200";
    default:
      return "bg-surface-alt text-text-muted border-border";
  }
}

// Group items into department buckets in the canonical order, appending an
// "Unassigned" bucket last. Empty buckets are dropped so the UI stays tight.
export function groupByDepartment<T>(
  items: T[],
  get: (t: T) => Department | null
): { department: Department | "Unassigned"; items: T[] }[] {
  const buckets = new Map<Department | "Unassigned", T[]>();
  for (const it of items) {
    const key = get(it) ?? "Unassigned";
    const list = buckets.get(key) ?? [];
    list.push(it);
    buckets.set(key, list);
  }
  const ordered: (Department | "Unassigned")[] = [...DEPARTMENTS, "Unassigned"];
  return ordered
    .filter((d) => buckets.has(d))
    .map((d) => ({ department: d, items: buckets.get(d) ?? [] }));
}
```

- [ ] **Step 2: Verify typecheck & lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/department.ts
git commit -m "feat: add department constants, colors, and grouping helper"
```

---

### Task 4: Extend server-action inputs (rocks, IDS, to-dos)

**Files:**
- Modify: `src/lib/rocks-actions.ts` (`RockInput`, `createRock`, `updateRock`)
- Modify: `src/lib/l10-actions.ts` (`ActionItemInput`, `IdsItemInput`, `createActionItem`, `updateActionItem`, `createIdsItem`, `updateIdsItem`)

**Interfaces:**
- Consumes: `Department` from `database.types`.
- Produces: `department` writable on all three; `progress_note` on rocks; `rock_id` on IDS. `update*` already spread `input`, so only the create paths + Input types need touching.

- [ ] **Step 1: Extend `rocks-actions.ts`**

Add `import type { Department } from "./database.types";` (extend the existing type import). In `RockInput` add:
```ts
  department?: Department | null;
  progress_note?: string | null;
```
In `createRock`'s insert object add:
```ts
    department: input.department ?? null,
    progress_note: input.progress_note ?? null,
```
(`updateRock` spreads `input` — no change needed.)

- [ ] **Step 2: Extend `l10-actions.ts`**

Add `Department` to the existing `import type { … } from "./database.types";`. In `ActionItemInput` add `department?: Department | null;`. In `IdsItemInput` add `department?: Department | null;` and `rock_id?: number | null;`. In `createActionItem`'s insert add `department: input.department ?? null,`. In `createIdsItem`'s insert add:
```ts
    department: input.department ?? null,
    rock_id: input.rock_id ?? null,
```
(`updateActionItem` / `updateIdsItem` spread `input` — no change.)

- [ ] **Step 3: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/rocks-actions.ts src/lib/l10-actions.ts
git commit -m "feat(actions): accept department (+ progress_note / rock_id) on writes"
```

---

### Task 5: Re-seed rocks — new `SEED_ROCKS` + guarded reset action

**Files:**
- Modify: `src/lib/rocks.ts` (`RockSeed` type + `SEED_ROCKS` constant)
- Modify: `src/lib/rocks-actions.ts` (`seedRocks` payload; add `resetAndSeedRocks`)

**Interfaces:**
- Consumes: `RockInput`, `Department`.
- Produces: `SEED_ROCKS` carrying `department`, `progress_note`, `status`; `resetAndSeedRocks(dryRun: boolean): Promise<{ willDelete: number; willInsert: number }>`.

- [ ] **Step 1: Extend the `RockSeed` type**

In `src/lib/rocks.ts`, add `Department` to the type import and change `RockSeed`:

```ts
export type RockSeed = {
  title: string;
  owner: string;
  rock_type: RockType;
  department: Department;
  progress_note: string;
  status?: RockStatus;
  smart: string;
};
```
(Add `import type { … Department, RockStatus … } from "./database.types";` to the existing import.)

- [ ] **Step 2: Replace `SEED_ROCKS` with the current Q3 list**

Replace the whole `SEED_ROCKS` array with:

```ts
export const SEED_ROCKS: RockSeed[] = [
  // ── Admin ──
  { title: "Email templates", owner: "Daniel", rock_type: "company", department: "Admin", progress_note: "1/7", smart: "Reusable email template set built and in use across client + internal comms." },
  { title: "Meeting flows / templates", owner: "Daniel", rock_type: "company", department: "Admin", progress_note: "2/9", smart: "Meeting flows and templates documented and run from a single source." },
  { title: "Onboarding end-to-end + team wiki", owner: "Daniel", rock_type: "company", department: "Admin", progress_note: "0/8", smart: "Onboarding runs end-to-end; the team wiki holds every core SOP." },
  { title: "Single-owner accountability map for ops", owner: "Daniel", rock_type: "company", department: "Admin", progress_note: "3/6", smart: "Every ops responsibility has one named owner on a published map." },
  { title: "Legal / compliance / contracts", owner: "Jack", rock_type: "company", department: "Admin", progress_note: "0/6", smart: "Liability, compliance, and contract templates reviewed and current." },
  // ── Growth ──
  { title: "Lead Gen — AgencyOS (high-ticket)", owner: "Jack", rock_type: "individual", department: "Growth", progress_note: "1/5", smart: "Pipeline for five-figure agency-OS clients live with first qualified opportunities." },
  { title: "Lead Gen — Heavy Duty Leads", owner: "Jack", rock_type: "individual", department: "Growth", progress_note: "0/6", smart: "Heavy Duty Leads channel producing qualified leads on a repeatable motion." },
  { title: "Verticalization playbook", owner: "Jack", rock_type: "company", department: "Growth", progress_note: "0/4", smart: "A documented playbook for taking the offer into a named vertical." },
  { title: "Customer-experience journey", owner: "Jack", rock_type: "company", department: "Growth", progress_note: "1/5", smart: "Client journey mapped end-to-end with owners at each stage." },
  { title: "Add Google Ads business with Daniel UK", owner: "Jack", rock_type: "individual", department: "Growth", progress_note: "0/1", smart: "Google Ads UK entity go/no-go decided and, if go, stood up with Daniel." },
  // ── Internal ──
  { title: "Plane / PM — self-host on Ares + AgencyOS integration", owner: "Daniel", rock_type: "company", department: "Internal", progress_note: "1/9", smart: "Plane self-hosted on Ares and integrated into AgencyOS." },
  { title: "Data Architecture Map", owner: "Leo", rock_type: "company", department: "Internal", progress_note: "0/4", smart: "The data architecture charted end-to-end and validated." },
  { title: "Data is #1 — per-client BigQuery + Plane + Obsidian", owner: "Leo", rock_type: "company", department: "Internal", progress_note: "0/5", smart: "Per-client data lands in BigQuery, wired to Plane and Obsidian." },
  { title: "Workflows + SOPs + audit build + client data", owner: "Leo", rock_type: "company", department: "Internal", progress_note: "0/5", smart: "Client workflows, SOPs, and audit backend built on the client data model." },
  { title: "Build 4-5 internal sites (with Mostafa)", owner: "Leo", rock_type: "company", department: "Internal", progress_note: "0/1", smart: "Four to five internal sites built with Mostafa as the workflow test." },
  { title: "UX / user-journey skill in Claude (with Mostafa)", owner: "Leo", rock_type: "company", department: "Internal", progress_note: "0/1", smart: "A reusable UX / user-journey skill in Claude, built with Mostafa." },
  { title: "Security / access (repos, Vercel, VPS doc hosting)", owner: "Rehan", rock_type: "company", department: "Internal", progress_note: "0/32", smart: "Repos, Vercel, and VPS doc hosting access hardened to best practice." },
  { title: "Code review workflows", owner: "Rehan", rock_type: "company", department: "Internal", progress_note: "0/17", smart: "Code review workflows defined and adopted across the team." },
  { title: "G-Suite multi-domain", owner: "Rehan", rock_type: "company", department: "Internal", progress_note: "1/1", status: "Done", smart: "G-Suite set up across both domains." },
  { title: "Internal Dashboard / AgencyOS", owner: "Kas", rock_type: "company", department: "Internal", progress_note: "0/11", smart: "The internal agency-OS dashboard scoped and first surface demoable." },
  { title: "Client Dashboard", owner: "Kas", rock_type: "company", department: "Internal", progress_note: "0/7", smart: "A client-facing dashboard surface built on the client journey." },
  { title: "Audit / Offer / Proposal full system", owner: "Kas", rock_type: "company", department: "Internal", progress_note: "0/5", smart: "Jack can run 90% of the audit → strategy, report, and proposal draft." }
];
```

- [ ] **Step 3: Update `seedRocks` payload + add `resetAndSeedRocks`**

In `src/lib/rocks-actions.ts`, update `seedRocks`'s payload map to include the new fields:
```ts
  const payload = rows.map((r, i) => ({
    title: r.title,
    owner: r.owner,
    rock_type: r.rock_type,
    department: r.department,
    progress_note: r.progress_note,
    status: r.status ?? "On track",
    quarter: QUARTER,
    smart: r.smart,
    sort_order: i
  }));
```
Add `import { QUARTER, type RockSeed } from "./rocks";` (extend existing import). Then append a guarded reset-and-seed that replaces the stale July seed:

```ts
// Replace the current-quarter rocks with the seed list. Guarded: dryRun returns
// the plan and mutates nothing. A real run deletes only this quarter's rocks
// (leaving other quarters intact), then inserts the seed. Operator-triggered.
export async function resetAndSeedRocks(dryRun: boolean): Promise<{ willDelete: number; willInsert: number }> {
  const supabase = createClient();
  const { data: existing, error: readErr } = await supabase
    .from("rocks")
    .select("id")
    .eq("quarter", QUARTER);
  if (readErr) throw new Error(readErr.message);
  const plan = { willDelete: existing?.length ?? 0, willInsert: SEED_ROCKS.length };
  if (dryRun) return plan;

  const { error: delErr } = await supabase.from("rocks").delete().eq("quarter", QUARTER);
  if (delErr) throw new Error(delErr.message);
  await seedRocks(SEED_ROCKS);
  revalidateRocks();
  return plan;
}
```
Add `SEED_ROCKS` to the `./rocks` import.

- [ ] **Step 4: Verify typecheck & build**

Run: `npm run typecheck && npm run build`
Expected: PASS. (Build compiles the server actions; a Supabase-less build still succeeds — actions only run at request time.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/rocks.ts src/lib/rocks-actions.ts
git commit -m "feat: re-seed rocks to Q3 2026 list with departments + progress notes"
```

---

### Task 6: RocksTrackerSection — group by department, progress badge

**Files:**
- Modify: `src/components/rocks-tracker-section.tsx`

**Interfaces:**
- Consumes: `DEPARTMENTS`, `getDepartmentClasses`, `groupByDepartment` from `@/lib/department`; `Rock` with `department` / `progress_note`.
- Produces: department → owner nested grouping; `progress_note` badge on each `RockCard`.

- [ ] **Step 1: Add outer department grouping**

Import at top:
```ts
import { getDepartmentClasses, groupByDepartment } from "@/lib/department";
```
Replace the single owner-grouping block with a department-first structure: wrap the existing owner grouping in `groupByDepartment(forQuarter, (r) => r.department)`, and for each department bucket run the current owner-grouping logic over `bucket.items`. Render a department header (with `getDepartmentClasses`) above each bucket, then the existing per-owner grid inside it. Compute a per-department "% On Track" using the same formula already in the file (`status !== "Off track"`).

- [ ] **Step 2: Add the progress badge to `RockCard`**

In `RockCard`, next to the `rock_type` line, render the note when present:
```tsx
{rock.progress_note && (
  <span className="ml-2 rounded-full border border-border bg-surface px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-text-muted">
    {rock.progress_note}
  </span>
)}
```

- [ ] **Step 3: Verify build & manual check**

Run: `npm run build`
Expected: PASS.
Manual (after Task 9 migration + reseed): `/weekly` shows Rocks under **Admin → Growth → Internal**, owners inside, each rock with its `1/7`-style badge; G-Suite shows Done.

- [ ] **Step 4: Commit**

```bash
git add src/components/rocks-tracker-section.tsx
git commit -m "feat(weekly): group rocks by department with progress badges"
```

---

### Task 7: Department on IDS + To-dos (column, group toggle, rock link)

**Files:**
- Modify: `src/components/ids-section.tsx` (department select in add/edit; department column; group-by-department toggle; optional Rock picker + chip)
- Modify: `src/components/action-items-section.tsx` (department select in add/edit; department column; group-by-department toggle)

**Interfaces:**
- Consumes: `DEPARTMENTS`, `getDepartmentClasses`, `groupByDepartment`; `createIdsItem`/`updateIdsItem`/`createActionItem`/`updateActionItem` (now accept `department` / `rock_id`); `Rock[]` for the picker.
- Produces: department-tagged, department-groupable IDS + to-dos; IDS rows linked to a rock show its title chip.

- [ ] **Step 1: IDS — add Department select + Rock picker to add/edit**

In `ids-section.tsx`, add a `Department` select (options `DEPARTMENTS`, plus a blank "—") to the add row and the inline editor, writing `department` through `createIdsItem`/`updateIdsItem`. Add an optional **Rock** `<select>` populated from a new `rocks: Rock[]` prop (value = `rock_id`), writing `rock_id`. Pass `rocks` down from `WeeklyBoard` (it already holds `rocks` state) — add `rocks={rocks}` where `<IdsSection … />` is rendered and add the prop to `IdsSection`'s signature.

- [ ] **Step 2: IDS — department column, chip, and group toggle**

Add a `Client/Internal`-style Department cell rendering `getDepartmentClasses`. Add a `groupByDepartment(sorted, (i) => i.department)` view behind a small "Group by department" toggle (default off, preserving today's flat newest-first list). When a row has a `rock_id`, resolve the title from the `rocks` prop and render it as a chip in the Issue cell.

- [ ] **Step 3: To-dos — Department select + column + group toggle**

In `action-items-section.tsx`, mirror Steps 1–2 minus the rock picker: `Department` select in add/edit writing `department`; a department cell; a "Group by department" toggle over `groupByDepartment`.

- [ ] **Step 4: Verify build & manual check**

Run: `npm run typecheck && npm run build`
Expected: PASS.
Manual: on `/weekly`, add/edit an issue and a to-do with a department; toggle "Group by department"; link an issue to a rock and see its chip.

- [ ] **Step 5: Commit**

```bash
git add src/components/ids-section.tsx src/components/action-items-section.tsx src/components/weekly-board.tsx
git commit -m "feat(weekly): department tagging + grouping on IDS and to-dos; IDS→rock link"
```

---

### Task 8: IDS reconciliation — guarded dry-run action

**Files:**
- Create: `src/lib/reconcile-ids.ts` (canonical issue list + plan builder)
- Modify: `src/lib/l10-actions.ts` (add `reconcileIds`)

**Interfaces:**
- Consumes: live `ids_items`; `rocks` (to resolve `rock_id` by title); `Department`.
- Produces: `CANONICAL_IDS: { issue: string; department: Department; owner: TeamMember; rockTitle: string | null; priority: L10Priority }[]`; `reconcileIds(dryRun: boolean): Promise<ReconcilePlan>` where `ReconcilePlan = { toArchive: {id:number;issue:string}[]; toInsert: string[]; unchanged: number }`.

- [ ] **Step 1: Define the canonical set**

Create `src/lib/reconcile-ids.ts`:

```ts
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
```

- [ ] **Step 2: Add the `reconcileIds` action**

In `src/lib/l10-actions.ts` add:

```ts
import { CANONICAL_IDS } from "./reconcile-ids";

export type ReconcilePlan = {
  toArchive: { id: number; issue: string }[];
  toInsert: string[];
  unchanged: number;
};

// Reconcile live IDS against the rocks: archive open issues not in the canonical
// set, insert any canonical issue missing (matched case-insensitively by text),
// linking each to its rock. Guarded: dryRun returns the plan and mutates nothing.
export async function reconcileIds(dryRun: boolean): Promise<ReconcilePlan> {
  const supabase = createClient();
  const [{ data: open, error: idsErr }, { data: rocks, error: rocksErr }] = await Promise.all([
    supabase.from("ids_items").select("id, issue").eq("archived", false),
    supabase.from("rocks").select("id, title")
  ]);
  if (idsErr) throw new Error(idsErr.message);
  if (rocksErr) throw new Error(rocksErr.message);

  const norm = (s: string) => s.trim().toLowerCase();
  const canonicalSet = new Set(CANONICAL_IDS.map((c) => norm(c.issue)));
  const openByText = new Map((open ?? []).map((o) => [norm(o.issue), o]));

  const toArchive = (open ?? []).filter((o) => !canonicalSet.has(norm(o.issue)));
  const toInsert = CANONICAL_IDS.filter((c) => !openByText.has(norm(c.issue)));
  const plan: ReconcilePlan = {
    toArchive: toArchive.map((o) => ({ id: o.id, issue: o.issue })),
    toInsert: toInsert.map((c) => c.issue),
    unchanged: CANONICAL_IDS.length - toInsert.length
  };
  if (dryRun) return plan;

  const rockIdByTitle = new Map((rocks ?? []).map((r) => [r.title, r.id]));
  for (const o of toArchive) {
    const { error } = await supabase.from("ids_items").update({ archived: true }).eq("id", o.id);
    if (error) throw new Error(error.message);
  }
  for (const c of toInsert) {
    const { error } = await supabase.from("ids_items").insert({
      issue: c.issue,
      owner: c.owner,
      priority: c.priority,
      department: c.department,
      rock_id: c.rockTitle ? rockIdByTitle.get(c.rockTitle) ?? null : null,
      status: "Not started"
    });
    if (error) throw new Error(error.message);
  }
  revalidateDaily();
  return plan;
}
```

- [ ] **Step 3: Verify typecheck & build**

Run: `npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/reconcile-ids.ts src/lib/l10-actions.ts
git commit -m "feat: guarded IDS reconciliation against canonical rock-aligned set"
```

---

### Task 9: Operator run — apply migration, reseed, reconcile (live data)

**Files:** none (operational). This task is run by Daniel, not the implementer.

- [ ] **Step 1: Apply the migration**

In the Supabase SQL editor, paste and run `supabase/migrations/012_departments.sql`. Confirm the `department` type and new columns exist (`select column_name from information_schema.columns where table_name='ids_items';`).

- [ ] **Step 2: Dry-run then apply the rock re-seed**

Wire a temporary "Reset & seed rocks" affordance on `/rocks` (or call the action from a server component) with `dryRun: true` first. Confirm `{ willDelete: <current Q3 count>, willInsert: 22 }`, then run with `dryRun: false`. Verify `/weekly` shows the 22 rocks grouped by department.

- [ ] **Step 3: Dry-run then apply IDS reconciliation**

Call `reconcileIds(true)`, review `toArchive` / `toInsert` (client headlines are untouched — this only reads `ids_items`). If the plan looks right, run `reconcileIds(false)`. Verify the 8 canonical issues appear, department-tagged and rock-linked.

- [ ] **Step 4: Deploy**

`git push` and let Vercel deploy, or `vercel --prod`. Confirm the live `/weekly` board matches.

---

## Self-Review

**Spec coverage (Phase 1 sections):**
- `012_departments.sql` schema → Task 1 ✅
- Types → Task 2 ✅
- Re-seed rocks + department mapping → Task 5 ✅ (22 rows: 5 Admin / 5 Growth / 12 Internal)
- Clean IDS (archive/merge/tag/link, dry-run) → Tasks 8–9 ✅
- Department grouping UI (rocks/IDS/to-dos) → Tasks 6–7 ✅
- Client headlines + IDS preserved → no task removes them; IDS is only extended ✅
- `completed_at` column present for Phase 2 → Task 1 ✅ (stamping deferred to Phase 2 plan, as specced)

**Placeholder scan:** none — every code step carries complete code; operator steps (Task 9) are intentionally manual and marked as such.

**Type consistency:** `Department` (Task 2) used identically in Tasks 3–8; `resetAndSeedRocks` / `reconcileIds` signatures match their callers; owner `"Leonardo"` uses the `TeamMember` enum spelling (not "Leo") in `CANONICAL_IDS` while rock `owner` free-text uses "Leo" per `ROCK_OWNERS`. Progress badge reads `rock.progress_note` as defined in Task 2.

**Out of scope (this plan):** Completed-since-last list rendering, Innovation, Backlog, and AI/Fathom summaries — these are Phases 2 & 3, each getting its own plan once Phase 1 is verified live.
