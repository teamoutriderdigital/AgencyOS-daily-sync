# L10 Phase 2 — Momentum Modules (Completed / Innovation / Backlog) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three read-and-write momentum modules to the weekly L10 board — a derived "Completed since last meeting" list, an Innovation log, and a reviewable Backlog — all grouped by the department dimension Phase 1 introduced.

**Architecture:** Additive, following Phase 1. "Completed" is a *derived* section over the existing rocks/IDS/to-dos already in the weekly snapshot — no new table, but it needs a real `completed_at` stamp written when items close. Innovation and Backlog are two small new tables with the same open-RLS + realtime + `touch_updated_at` shape as migration `003`. All three render on `/weekly` and reuse the `department` lib.

**Tech Stack:** Next.js 14 (app router, server actions), Supabase (Postgres + Realtime), TypeScript, Tailwind. No test framework — verification is `npm run typecheck`, `npm run lint`, `npm run build`, and manual two-window checks. Migrations are applied by pasting SQL into the Supabase SQL editor.

**Depends on:** Phase 1 merged (migration `012` applied: `department` enum, `completed_at` on `action_items`/`ids_items`; `src/lib/department.ts`).

## Global Constraints

- **Additive only.** Do not alter Phase 1 behavior. New tables never duplicate rocks/IDS/to-dos.
- **Migrations idempotent**, open RLS, added to `supabase_realtime`, `touch_updated_at` trigger — matching `supabase/migrations/003_rocks_meeting.sql`. Next numbers: `013`, `014`.
- **`completed_at` is the completion clock.** Stamp `now()` when an item transitions to done/solved/Done; set `null` when it reopens. Never overwrite a non-null stamp on an unrelated edit.
- **"Since last meeting" = the selected ISO week.** Completed list shows items whose `completed_at` falls within the selected week (reuse the existing `itemInWeek`/week-range helpers where possible; for `completed_at` filter on the week's date range).
- **Department order** is exactly Admin, Growth, Internal (then Unassigned) — via `groupByDepartment`.
- **`found_by` / backlog owner stay free text** (rocks-roster width), like `rocks.owner`.
- Realtime + snapshot wiring must mirror the existing `weekly-board.tsx` channel pattern exactly.

---

### Task 1: Migration `013_completed_innovations.sql`

**Files:**
- Create: `supabase/migrations/013_completed_innovations.sql`

**Interfaces:**
- Produces: `rocks.completed_at` column; `innovations` table (`id, title, url, found_by, note, department, created_at, updated_at`).

- [ ] **Step 1: Write the migration**

```sql
-- Phase 2: rocks completion clock + the Innovation log.
--
-- rocks.completed_at mirrors the ids_items/action_items columns added in 012, so
-- the weekly "Completed since last meeting" list can date a Done rock precisely
-- (status alone doesn't record WHEN it flipped). innovations is a small log of
-- new tools/discoveries (Mobbin, etc.). Same open-RLS + realtime + touch shape
-- as 003. Idempotent.

alter table rocks add column if not exists completed_at timestamptz;

create table if not exists innovations (
  id serial primary key,
  title text not null default '',
  url text,
  found_by text,
  note text,
  department department,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists innovations_touch on innovations;
create trigger innovations_touch before update on innovations
  for each row execute function touch_updated_at();

alter table innovations enable row level security;
drop policy if exists "open_innovations" on innovations;
create policy "open_innovations" on innovations for all using (true) with check (true);

do $$
declare pub_exists boolean;
begin
  select exists(select 1 from pg_publication where pubname = 'supabase_realtime') into pub_exists;
  if pub_exists then
    begin alter publication supabase_realtime add table innovations; exception when duplicate_object then null; end;
  end if;
end $$;
```

- [ ] **Step 2: Verify by inspection** — `add column if not exists`; `create table if not exists`; `touch_updated_at` already exists from `003`; `department` enum exists from `012`. No DB run here.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/013_completed_innovations.sql
git commit -m "feat(db): add rocks.completed_at + innovations table"
```

---

### Task 2: Migration `014_backlog.sql`

**Files:**
- Create: `supabase/migrations/014_backlog.sql`

**Interfaces:**
- Produces: `backlog_source` enum (`manual`, `fathom`); `backlog_items` table (`id, title, detail, department, source, source_ref, reviewed, created_at, updated_at`).

- [ ] **Step 1: Write the migration**

```sql
-- Phase 2: the Backlog — future-client ideas + parked items, triaged ~2x/month.
-- source distinguishes hand-added rows from Phase-3 Fathom-flagged ones;
-- source_ref holds the Fathom recording id/URL when source='fathom'. reviewed
-- drives the triage filter. Same open-RLS + realtime + touch shape as 003.

do $$ begin
  create type backlog_source as enum ('manual', 'fathom');
exception when duplicate_object then null; end $$;

create table if not exists backlog_items (
  id serial primary key,
  title text not null default '',
  detail text,
  department department,
  source backlog_source not null default 'manual',
  source_ref text,
  reviewed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists backlog_items_reviewed_idx on backlog_items(reviewed);

drop trigger if exists backlog_items_touch on backlog_items;
create trigger backlog_items_touch before update on backlog_items
  for each row execute function touch_updated_at();

alter table backlog_items enable row level security;
drop policy if exists "open_backlog_items" on backlog_items;
create policy "open_backlog_items" on backlog_items for all using (true) with check (true);

do $$
declare pub_exists boolean;
begin
  select exists(select 1 from pg_publication where pubname = 'supabase_realtime') into pub_exists;
  if pub_exists then
    begin alter publication supabase_realtime add table backlog_items; exception when duplicate_object then null; end;
  end if;
end $$;
```

- [ ] **Step 2: Verify by inspection** (enum guarded; table/index `if not exists`).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/014_backlog.sql
git commit -m "feat(db): add backlog_items table + backlog_source enum"
```

---

### Task 3: Extend types for innovations, backlog, completed_at

**Files:**
- Modify: `src/lib/database.types.ts`

**Interfaces:**
- Consumes: Tasks 1–2 schema.
- Produces: `BacklogSource` type; `rocks.Row.completed_at`; `innovations` and `backlog_items` table types.

- [ ] **Step 1: Add the enum type**

After `Department` add:
```ts
export type BacklogSource = "manual" | "fathom";
```

- [ ] **Step 2: Add `completed_at` to `rocks.Row`**

In `rocks.Row` add:
```ts
          completed_at: string | null;
```

- [ ] **Step 3: Add the two new table blocks**

Inside `Tables`, add:
```ts
      innovations: {
        Row: {
          id: number;
          title: string;
          url: string | null;
          found_by: string | null;
          note: string | null;
          department: Department | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["innovations"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["innovations"]["Row"]>;
        Relationships: [];
      };
      backlog_items: {
        Row: {
          id: number;
          title: string;
          detail: string | null;
          department: Department | null;
          source: BacklogSource;
          source_ref: string | null;
          reviewed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["backlog_items"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["backlog_items"]["Row"]>;
        Relationships: [];
      };
```

- [ ] **Step 4: Verify** — `npm run typecheck` PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/database.types.ts
git commit -m "feat(types): add innovations, backlog_items, rocks.completed_at"
```

---

### Task 4: Stamp `completed_at` on close/reopen

**Files:**
- Modify: `src/lib/l10-actions.ts` (`toggleActionItemDone`; `updateIdsItem`)
- Modify: `src/lib/rocks-actions.ts` (`setRockStatus`)

**Interfaces:**
- Produces: `completed_at` written `now()`/`null` on transitions, so the derived Completed list can date items.

- [ ] **Step 1: Action items**

Replace `toggleActionItemDone`'s update with a completion-stamping version:
```ts
export async function toggleActionItemDone(id: number, done: boolean) {
  const supabase = createClient();
  const { error } = await supabase
    .from("action_items")
    .update({ done, completed_at: done ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidateDaily();
}
```

- [ ] **Step 2: IDS**

In `updateIdsItem`, derive a completion stamp when the caller sets `status` or `archived`. Replace the body with:
```ts
export async function updateIdsItem(id: number, input: Partial<IdsItemInput>) {
  const supabase = createClient();
  const patch: Partial<IdsItemInput> & { completed_at?: string | null } = { ...input };
  // Stamp when an issue closes (Solved or archived); clear when it reopens.
  if (input.status !== undefined || input.archived !== undefined) {
    const closing = input.status === "Solved" || input.archived === true;
    const reopening = input.status !== undefined && input.status !== "Solved" && input.archived !== true;
    if (closing) patch.completed_at = new Date().toISOString();
    else if (reopening || input.archived === false) patch.completed_at = null;
  }
  const { error } = await supabase.from("ids_items").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  revalidateDaily();
}
```
(`completed_at` is not part of `IdsItemInput`, so the local `patch` type widens it. Confirm `IdsItemInput` still excludes it.)

- [ ] **Step 3: Rocks**

Replace `setRockStatus`:
```ts
export async function setRockStatus(id: number, status: RockStatus) {
  const supabase = createClient();
  const { error } = await supabase
    .from("rocks")
    .update({ status, completed_at: status === "Done" ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidateRocks();
}
```

- [ ] **Step 4: Verify** — `npm run typecheck && npm run build` PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/l10-actions.ts src/lib/rocks-actions.ts
git commit -m "feat: stamp completed_at when to-dos/issues/rocks close (clear on reopen)"
```

---

### Task 5: Innovations — server actions

**Files:**
- Create: `src/lib/innovations.ts` (type alias + owners reuse)
- Create: `src/lib/innovations-actions.ts`

**Interfaces:**
- Produces: `Innovation = Tables<"innovations">`; `createInnovation/updateInnovation/deleteInnovation(input|id)`.

- [ ] **Step 1: Type module**

`src/lib/innovations.ts`:
```ts
import type { Tables } from "./database.types";
export type Innovation = Tables<"innovations">;
```

- [ ] **Step 2: Actions**

`src/lib/innovations-actions.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "./supabase-server";
import type { Department } from "./database.types";

export type InnovationInput = {
  title?: string;
  url?: string | null;
  found_by?: string | null;
  note?: string | null;
  department?: Department | null;
};

function revalidateWeekly() {
  revalidatePath("/weekly");
}

export async function createInnovation(input: InnovationInput) {
  const supabase = createClient();
  const { error } = await supabase.from("innovations").insert({
    title: input.title ?? "",
    url: input.url ?? null,
    found_by: input.found_by ?? null,
    note: input.note ?? null,
    department: input.department ?? null
  });
  if (error) throw new Error(error.message);
  revalidateWeekly();
}

export async function updateInnovation(id: number, input: InnovationInput) {
  const supabase = createClient();
  const { error } = await supabase.from("innovations").update(input).eq("id", id);
  if (error) throw new Error(error.message);
  revalidateWeekly();
}

export async function deleteInnovation(id: number) {
  const supabase = createClient();
  const { error } = await supabase.from("innovations").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateWeekly();
}
```

- [ ] **Step 3: Verify** — `npm run typecheck` PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/innovations.ts src/lib/innovations-actions.ts
git commit -m "feat: innovations type + CRUD server actions"
```

---

### Task 6: Backlog — server actions

**Files:**
- Create: `src/lib/backlog.ts`
- Create: `src/lib/backlog-actions.ts`

**Interfaces:**
- Produces: `BacklogItem = Tables<"backlog_items">`; `createBacklogItem/updateBacklogItem/deleteBacklogItem/setBacklogReviewed`.

- [ ] **Step 1: Type module**

`src/lib/backlog.ts`:
```ts
import type { Tables } from "./database.types";
export type BacklogItem = Tables<"backlog_items">;
```

- [ ] **Step 2: Actions**

`src/lib/backlog-actions.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "./supabase-server";
import type { Department } from "./database.types";

export type BacklogInput = {
  title?: string;
  detail?: string | null;
  department?: Department | null;
};

function revalidateWeekly() {
  revalidatePath("/weekly");
}

// Manual add only — source defaults to 'manual'. Fathom-sourced rows arrive in
// Phase 3 via a dedicated action, not this one.
export async function createBacklogItem(input: BacklogInput) {
  const supabase = createClient();
  const { error } = await supabase.from("backlog_items").insert({
    title: input.title ?? "",
    detail: input.detail ?? null,
    department: input.department ?? null
  });
  if (error) throw new Error(error.message);
  revalidateWeekly();
}

export async function updateBacklogItem(id: number, input: BacklogInput) {
  const supabase = createClient();
  const { error } = await supabase.from("backlog_items").update(input).eq("id", id);
  if (error) throw new Error(error.message);
  revalidateWeekly();
}

export async function setBacklogReviewed(id: number, reviewed: boolean) {
  const supabase = createClient();
  const { error } = await supabase.from("backlog_items").update({ reviewed }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidateWeekly();
}

export async function deleteBacklogItem(id: number) {
  const supabase = createClient();
  const { error } = await supabase.from("backlog_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateWeekly();
}
```

- [ ] **Step 3: Verify** — `npm run typecheck` PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/backlog.ts src/lib/backlog-actions.ts
git commit -m "feat: backlog type + CRUD server actions (manual source)"
```

---

### Task 7: Extend the weekly snapshot + server fetch

**Files:**
- Modify: `src/lib/weekly-server.ts` (`WeeklySnapshot`, `getWeeklySnapshot`, `emptySnapshot`)

**Interfaces:**
- Consumes: `Innovation`, `BacklogItem`.
- Produces: `WeeklySnapshot` gains `innovations: Innovation[]` and `backlogItems: BacklogItem[]`. (Completed list is derived client-side from the existing `actionItems`/`idsItems`/`rocks` — no new fetch.)

- [ ] **Step 1: Extend the snapshot type + empty**

Add imports:
```ts
import type { Innovation } from "./innovations";
import type { BacklogItem } from "./backlog";
```
Add to `WeeklySnapshot`:
```ts
  innovations: Innovation[];
  backlogItems: BacklogItem[];
```
In `emptySnapshot()` add `innovations: [], backlogItems: []`.

- [ ] **Step 2: Fetch them**

In the `Promise.all([...])` add two queries:
```ts
      supabase.from("innovations").select("*").order("created_at", { ascending: false }),
      supabase.from("backlog_items").select("*").order("created_at", { ascending: false })
```
Destructure `innovationsResp` and `backlogResp` alongside the others. After the existing error checks add non-fatal guards (mirror the `ratingsResp` pattern so a missing 013/014 migration doesn't blank the board):
```ts
    if (innovationsResp.error) console.error("innovations unavailable (run migration 013?):", innovationsResp.error.message);
    if (backlogResp.error) console.error("backlog_items unavailable (run migration 014?):", backlogResp.error.message);
```
Return:
```ts
      innovations: innovationsResp.error ? [] : innovationsResp.data ?? [],
      backlogItems: backlogResp.error ? [] : backlogResp.data ?? []
```

- [ ] **Step 3: Verify** — `npm run typecheck && npm run build` PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/weekly-server.ts
git commit -m "feat(weekly): load innovations + backlog into the snapshot"
```

---

### Task 8: CompletedSection (derived) + Innovation + Backlog components

**Files:**
- Create: `src/components/completed-section.tsx`
- Create: `src/components/innovation-section.tsx`
- Create: `src/components/backlog-section.tsx`

**Interfaces:**
- Consumes: `groupByDepartment`, `getDepartmentClasses`; `SectionShell`; the new actions; week helpers from `@/lib/weekly`.
- Produces: three section components rendered by `weekly-board.tsx` (Task 9).

- [ ] **Step 1: CompletedSection (read-only, derived)**

Create `src/components/completed-section.tsx`. It takes the week's items and lists those completed in the selected week, grouped by department. Props:
```tsx
"use client";

import { useMemo } from "react";
import type { ActionItem, IdsItem } from "@/lib/l10";
import type { Rock } from "@/lib/rocks";
import type { Department } from "@/lib/database.types";
import { getDepartmentClasses, groupByDepartment } from "@/lib/department";
import { SectionShell } from "./section-shell";

type CompletedEntry = { key: string; label: string; kind: "Rock" | "Issue" | "To-do"; department: Department | null };

// Items whose completed_at falls within [weekStartISO, weekEndISO). A read-only
// momentum column — the "done" side of the meeting. weekStartISO/weekEndISO are
// yyyy-mm-dd bounds for the selected ISO week (end exclusive).
export function CompletedSection({
  rocks,
  idsItems,
  actionItems,
  weekStartISO,
  weekEndISO
}: {
  rocks: Rock[];
  idsItems: IdsItem[];
  actionItems: ActionItem[];
  weekStartISO: string;
  weekEndISO: string;
}) {
  const entries = useMemo<CompletedEntry[]>(() => {
    const within = (ts: string | null) => !!ts && ts.slice(0, 10) >= weekStartISO && ts.slice(0, 10) < weekEndISO;
    const out: CompletedEntry[] = [];
    for (const r of rocks) if (r.status === "Done" && within(r.completed_at))
      out.push({ key: `rock-${r.id}`, label: r.title || "(untitled rock)", kind: "Rock", department: r.department });
    for (const i of idsItems) if (within(i.completed_at))
      out.push({ key: `ids-${i.id}`, label: i.issue, kind: "Issue", department: i.department });
    for (const a of actionItems) if (a.done && within(a.completed_at))
      out.push({ key: `todo-${a.id}`, label: a.item, kind: "To-do", department: a.department });
    return out;
  }, [rocks, idsItems, actionItems, weekStartISO, weekEndISO]);

  const groups = useMemo(() => groupByDepartment(entries, (e) => e.department), [entries]);

  return (
    <SectionShell title="Completed since last meeting" count={entries.length} countLabel="done this week">
      {entries.length === 0 ? (
        <p className="px-5 py-6 text-center text-xs italic text-text-muted">Nothing closed in this week yet.</p>
      ) : (
        <div className="space-y-4 px-5 py-4">
          {groups.map((g) => (
            <div key={g.department}>
              <span className={`mb-2 inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${getDepartmentClasses(g.department === "Unassigned" ? null : g.department)}`}>
                {g.department}
              </span>
              <ul className="space-y-1">
                {g.items.map((e) => (
                  <li key={e.key} className="flex items-center gap-2 text-sm text-text-muted">
                    <span className="text-green-600">✓</span>
                    <span className="rounded border border-border bg-surface-alt px-1.5 py-0.5 text-[10px] uppercase tracking-wide">{e.kind}</span>
                    <span className="line-through">{e.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </SectionShell>
  );
}
```

- [ ] **Step 2: InnovationSection**

Create `src/components/innovation-section.tsx`, modeled on `headlines-section.tsx` (read it for the add/edit/delete + `useTransition` conventions). It takes `items: Innovation[]`, renders a `SectionShell` titled "Innovation" with a "+ Add" button; each row shows `title`, an optional `url` link, `found_by`, `note`, and a `Department` badge/select (options `DEPARTMENTS`). Add row + inline edit write through `createInnovation`/`updateInnovation`; a trash button calls `deleteInnovation`. Free-text `found_by` input (no enum). Keep it one component; mirror the headlines styling tokens.

- [ ] **Step 3: BacklogSection**

Create `src/components/backlog-section.tsx`, same shape. Takes `items: BacklogItem[]`. `SectionShell` titled "Backlog". A header toggle "Show reviewed" (default OFF → show only `reviewed === false`). Each row: `title`, optional `detail`, `Department` badge, a `source` tag (`manual`/`fathom`), and a "Reviewed" checkbox calling `setBacklogReviewed`. Add row writes `createBacklogItem`; trash calls `deleteBacklogItem`. Fathom rows (`source==='fathom'`) render a small "Fathom" chip and, if `source_ref` looks like a URL, link it.

- [ ] **Step 4: Verify** — `npm run typecheck && npm run lint && npm run build` PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/completed-section.tsx src/components/innovation-section.tsx src/components/backlog-section.tsx
git commit -m "feat(weekly): Completed (derived), Innovation, and Backlog sections"
```

---

### Task 9: Wire sections into the weekly board (state + realtime + order)

**Files:**
- Modify: `src/components/weekly-board.tsx`

**Interfaces:**
- Consumes: `CompletedSection`, `InnovationSection`, `BacklogSection`; `Innovation`, `BacklogItem`; week helpers.
- Produces: the three sections rendered in the correct order with live state.

- [ ] **Step 1: State + snapshot**

Import the three components and the two types. Add state:
```ts
const [innovations, setInnovations] = useState<Innovation[]>(initialSnapshot.innovations);
const [backlogItems, setBacklogItems] = useState<BacklogItem[]>(initialSnapshot.backlogItems);
```

- [ ] **Step 2: Realtime channels**

In the existing master-tables `useEffect`, add two channels mirroring the `rocks` channel's INSERT/UPDATE/DELETE upsert pattern — one for `innovations`, one for `backlog_items` — updating `setInnovations`/`setBacklogItems`. Remember to `supabase.removeChannel(...)` both in the cleanup return.

- [ ] **Step 3: Compute the selected week's date bounds for Completed**

Using the existing `isoWeekStart` helper and the `selected` week, derive:
```ts
const weekStartISO = useMemo(() => isoWeekStart(selected.year, selected.week).toISOString().slice(0, 10), [selected]);
const weekEndISO = useMemo(() => {
  const d = isoWeekStart(selected.year, selected.week);
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
}, [selected]);
```
(Confirm `isoWeekStart` is exported from `@/lib/weekly`; it already is — `ratingDate` uses it.)

- [ ] **Step 4: Render order**

Update the render so sections appear:
```tsx
<RocksTrackerSection rocks={rocks} quarter={QUARTER} />
<CompletedSection rocks={rocks} idsItems={idsItems} actionItems={actionItems} weekStartISO={weekStartISO} weekEndISO={weekEndISO} />
<ClientStagesSection clients={clients} />
<IdsSection items={weekIds} rocks={rocks} />
<ActionItemsSection items={weekActions} />
<InnovationSection items={innovations} />
<BacklogSection items={backlogItems} />
<RatingSection ratings={ratings} date={ratingDate} />
```
(Completed uses the full `idsItems`/`actionItems` — not the week-filtered `weekIds`/`weekActions` — because it filters by `completed_at`, not the item's authored week.)

- [ ] **Step 5: Verify** — `npm run typecheck && npm run lint && npm run build` PASS. Manual (post-migration): close a to-do/issue/rock and see it appear under Completed for the current week; add an innovation and a backlog item; toggle "Show reviewed"; confirm two windows sync within ~2s.

- [ ] **Step 6: Commit**

```bash
git add src/components/weekly-board.tsx
git commit -m "feat(weekly): render Completed/Innovation/Backlog with live state"
```

---

### Task 10: Operator run (live data)

**Files:** none. Run by Daniel.

- [ ] **Step 1:** Apply `013_completed_innovations.sql` and `014_backlog.sql` in the Supabase SQL editor.
- [ ] **Step 2:** Deploy. Verify the three new sections render on `/weekly`; the Completed list is empty until items close (historical items were never stamped — expected, see Out of scope).

---

## Self-Review

**Spec coverage (Phase 2):**
- Completed since last meeting (derived, `completed_at`, grouped by dept) → Tasks 4, 8, 9 ✅
- Innovation table + section → Tasks 1, 3, 5, 8, 9 ✅
- Backlog table + reviewed filter (manual source; Fathom in Phase 3) → Tasks 2, 3, 6, 8, 9 ✅
- Realtime + snapshot wiring → Tasks 7, 9 ✅
- Department grouping reused → Tasks 8, 9 ✅

**Placeholder scan:** Migrations, types, and all actions carry complete code. Tasks 8 Steps 2–3 (Innovation/Backlog components) describe the component against a named existing template (`headlines-section.tsx`) with explicit fields/props/actions rather than full JSX — acceptable because they are direct structural clones of an existing component; the implementer reads that file and mirrors it. CompletedSection (the one genuinely new shape) is given in full.

**Type consistency:** `Innovation`/`BacklogItem` are `Tables<>` aliases (auto-match schema); `completed_at` added to `rocks.Row` (Task 3) is read in CompletedSection (Task 8); `setBacklogReviewed`/`createInnovation` signatures match their component callers; week-bounds use the existing `isoWeekStart`.

**Out of scope (this plan):** Fathom auto-backlog and AI summaries (Phase 3). Backfilling `completed_at` for items closed before migration `013` — the Completed list starts empty and fills as items close going forward.
