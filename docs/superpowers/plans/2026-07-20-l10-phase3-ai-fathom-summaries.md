# L10 Phase 3 — AI Summaries & Fathom-Fed Backlog — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each recurring rock/issue a cached 1–2 line AI recap of what was last said about it, generated from Fathom meeting transcripts, and auto-append Fathom-flagged parking-lot items to the Phase 2 Backlog.

**Architecture:** A new `item_summaries` cache table holds one summary per (item, week). Display is a pure read: rock cards and IDS rows render their summary inline when present — deliverable and safe regardless of how summaries get generated. Generation is an operator-triggered server action behind an env guard: it fetches the relevant Fathom transcript via **Fathom's REST API**, calls **Claude** (`@anthropic-ai/sdk`, `claude-opus-4-8`) to summarize per item, and upserts. Missing credentials degrade to "no summaries yet" — the board never blanks.

**Tech Stack:** Next.js 14 (app router, server actions), Supabase, TypeScript, Tailwind, `@anthropic-ai/sdk`. No test framework — verify with `npm run typecheck`, `npm run lint`, `npm run build`, and manual checks.

**Depends on:** Phase 1 + Phase 2 merged (department dimension; `backlog_items` with `source`/`source_ref`; the `/admin` dry-run panel). Reuses the `/admin` panel for the "Refresh summaries" trigger.

## ⚠️ Reality check — read before starting

- The **Fathom MCP connector** available in a Claude chat session is **NOT reachable from the deployed Next.js app.** The app must call Fathom's own REST API with a **`FATHOM_API_KEY`**. Fathom's exact endpoints/auth are **not assumed by this plan** — **Task 0 verifies the contract** (list recordings for a date range → fetch transcript) against Fathom's API docs before any generation code is written. If Fathom has no usable API for this workspace, stop and tell the user; the display layer (Tasks 1–3) still ships and summaries can be populated another way.
- Claude is called via the official SDK with `new Anthropic()` (reads `ANTHROPIC_API_KEY`) and model **`claude-opus-4-8`** — do not substitute another model or hand-roll HTTP.

## Global Constraints

- **Additive only.** Display of summaries must not alter Phase 1/2 behavior. `item_summaries` is a cache, never the source of truth — losing it costs only a regeneration.
- **Migration idempotent**, open RLS, realtime-registered, `touch_updated_at` — matching `003`. Next number: `015`.
- **Env-guarded generation.** `generateItemSummaries` throws a clear, catchable "credentials not configured" error when `FATHOM_API_KEY` or `ANTHROPIC_API_KEY` is absent; the `/admin` panel surfaces it. No credential values ever reach the client.
- **Idempotent generation.** Re-running a week upserts on `(item_type, item_id, week_number, year_number)` — never duplicates. Fathom-flagged backlog inserts dedupe on `source_ref` + normalized title.
- **Claude call:** `@anthropic-ai/sdk`, `model: "claude-opus-4-8"`, `max_tokens: 1024`, non-streaming, narrow `content` blocks by `type === "text"`. Summarization is simple — omit `thinking`.
- **`item_summaries` are "recurring items" only** — rocks for the quarter + IDS issues that carried over (`carried_from_week != null`) or are still open. Don't summarize one-off items.

---

### Task 0: Verify the Fathom API contract (research — no code)

**Files:** none (write findings to `.superpowers/sdd/fathom-api-notes.md`).

- [ ] **Step 1:** From Fathom's official API documentation, confirm and record: base URL; auth header shape for `FATHOM_API_KEY`; the endpoint to **list recordings/meetings filtered by date range** (and its response shape — recording id, title, date); the endpoint to **fetch a transcript** by recording id (and its shape). If a team/workspace scoping param is needed, record it.
- [ ] **Step 2:** If no suitable REST API exists (only the MCP connector), **stop and report** — Tasks 4–6 (generation) are blocked; Tasks 1–3 (display + schema) still proceed, and summaries/backlog are populated manually until an API path exists.
- [ ] **Step 3:** Record the exact request/response shapes the later tasks will code against. These notes are the interface for Task 4.

---

### Task 1: Migration `015_item_summaries.sql`

**Files:**
- Create: `supabase/migrations/015_item_summaries.sql`

**Interfaces:**
- Produces: `item_summaries` table with a unique key on `(item_type, item_id, week_number, year_number)`.

- [ ] **Step 1: Write the migration**

```sql
-- Phase 3: per-item AI summary cache. One row per (rock|issue, ISO week): a
-- 1-2 line recap generated from Fathom transcripts so the weekly L10 opens with
-- context already written. A cache, not source-of-truth — safe to wipe/regen.

create table if not exists item_summaries (
  id serial primary key,
  item_type text not null,          -- 'rock' | 'ids'
  item_id integer not null,
  week_number integer not null,
  year_number integer not null,
  summary text not null,
  source_ref text,                  -- Fathom recording id(s) used
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (item_type, item_id, week_number, year_number)
);

create index if not exists item_summaries_lookup_idx
  on item_summaries(item_type, item_id, week_number, year_number);

drop trigger if exists item_summaries_touch on item_summaries;
create trigger item_summaries_touch before update on item_summaries
  for each row execute function touch_updated_at();

alter table item_summaries enable row level security;
drop policy if exists "open_item_summaries" on item_summaries;
create policy "open_item_summaries" on item_summaries for all using (true) with check (true);

do $$
declare pub_exists boolean;
begin
  select exists(select 1 from pg_publication where pubname = 'supabase_realtime') into pub_exists;
  if pub_exists then
    begin alter publication supabase_realtime add table item_summaries; exception when duplicate_object then null; end;
  end if;
end $$;
```

- [ ] **Step 2: Verify by inspection** (`create table if not exists`, unique constraint, touch trigger, open RLS).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/015_item_summaries.sql
git commit -m "feat(db): add item_summaries AI-recap cache table"
```

---

### Task 2: Types + summary lib + snapshot wiring

**Files:**
- Modify: `src/lib/database.types.ts` (add `item_summaries` table type)
- Create: `src/lib/summaries.ts` (type alias + lookup helper)
- Modify: `src/lib/weekly-server.ts` (load the selected week's summaries into the snapshot)

**Interfaces:**
- Produces: `ItemSummary = Tables<"item_summaries">`; `summaryKey(type, id): string` + `indexSummaries(rows): Map<string, ItemSummary>`; `WeeklySnapshot.summaries: ItemSummary[]`.

- [ ] **Step 1: Add the table type**

In `src/lib/database.types.ts`, inside `Tables`, add:
```ts
      item_summaries: {
        Row: {
          id: number;
          item_type: string;
          item_id: number;
          week_number: number;
          year_number: number;
          summary: string;
          source_ref: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["item_summaries"]["Row"]> & {
          item_type: string;
          item_id: number;
          week_number: number;
          year_number: number;
          summary: string;
        };
        Update: Partial<Database["public"]["Tables"]["item_summaries"]["Row"]>;
        Relationships: [];
      };
```

- [ ] **Step 2: Summary lib**

Create `src/lib/summaries.ts`:
```ts
import type { Tables } from "./database.types";

export type ItemSummary = Tables<"item_summaries">;

// Stable key so a rock card / IDS row can find its summary in O(1).
export function summaryKey(itemType: "rock" | "ids", itemId: number): string {
  return `${itemType}:${itemId}`;
}

export function indexSummaries(rows: ItemSummary[]): Map<string, ItemSummary> {
  const m = new Map<string, ItemSummary>();
  for (const r of rows) m.set(summaryKey(r.item_type as "rock" | "ids", r.item_id), r);
  return m;
}
```

- [ ] **Step 3: Snapshot wiring**

In `src/lib/weekly-server.ts`: import `ItemSummary`; add `summaries: ItemSummary[]` to `WeeklySnapshot` and `summaries: []` to `emptySnapshot()`. Add a query to the `Promise.all` for the **current** week (the board refetches on week change — Task 4 handles per-week fetch; the initial snapshot loads the current week):
```ts
      supabase
        .from("item_summaries")
        .select("*")
        .eq("week_number", cur.week)
        .eq("year_number", cur.year)
```
Guard non-fatally (mirror `ratingsResp`): `if (summariesResp.error) console.error("item_summaries unavailable (run migration 015?):", summariesResp.error.message);` and return `summariesResp.error ? [] : summariesResp.data ?? []`.

- [ ] **Step 4: Verify** — `npm run typecheck && npm run build` PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/database.types.ts src/lib/summaries.ts src/lib/weekly-server.ts
git commit -m "feat: item_summaries type, lookup helper, and weekly snapshot load"
```

---

### Task 3: Render summaries inline on rocks + IDS (display only)

**Files:**
- Modify: `src/components/weekly-board.tsx` (hold summaries state, fetch per selected week, pass an index down)
- Modify: `src/components/rocks-tracker-section.tsx` (render a rock's summary)
- Modify: `src/components/ids-section.tsx` (render an issue's summary)

**Interfaces:**
- Consumes: `ItemSummary`, `summaryKey`, `indexSummaries`; the selected `IsoWeek`.
- Produces: an inline, muted, collapsible summary line on each rock card and IDS row when one exists for the selected week.

- [ ] **Step 1: Board state + per-week fetch**

In `weekly-board.tsx`: `const [summaries, setSummaries] = useState<ItemSummary[]>(initialSnapshot.summaries);`. In a `useEffect` keyed on `[supabase, selected]`, fetch `item_summaries` where `week_number = selected.week and year_number = selected.year` and `setSummaries`, and subscribe to an `item_summaries` realtime channel that updates rows for the selected week (mirror the ratings-channel pattern; filter client-side by week). Build `const summaryIndex = useMemo(() => indexSummaries(summaries), [summaries]);` and pass `summaries={summaryIndex}` to `<RocksTrackerSection>` and `<IdsSection>`.

- [ ] **Step 2: Rock card summary**

`RocksTrackerSection` + `RockCard` accept `summaries: Map<string, ItemSummary>`. In `RockCard`, after the SMART line:
```tsx
{summaries.get(summaryKey("rock", rock.id)) && (
  <p className="mt-1 rounded bg-surface-alt/60 px-2 py-1 text-[11px] italic text-text-muted">
    <span className="font-semibold not-italic">Last meeting: </span>
    {summaries.get(summaryKey("rock", rock.id))!.summary}
  </p>
)}
```
Thread the `summaries` prop from `RocksTrackerSection` through the department/owner grouping into each `RockCard`.

- [ ] **Step 3: IDS row summary**

`IdsSection` accepts `summaries: Map<string, ItemSummary>`; in the expanded row area (where identify/discuss/solve show), render the same muted "Last meeting: …" line when `summaries.get(summaryKey("ids", item.id))` exists.

- [ ] **Step 4: Verify** — `npm run typecheck && npm run lint && npm run build` PASS. Manual: insert a test `item_summaries` row and confirm it renders on the matching rock/issue for that week.

- [ ] **Step 5: Commit**

```bash
git add src/components/weekly-board.tsx src/components/rocks-tracker-section.tsx src/components/ids-section.tsx
git commit -m "feat(weekly): render cached AI summaries inline on rocks and IDS"
```

---

### Task 4: Fathom client + generation action

**Files:**
- Create: `src/lib/fathom.ts` (thin Fathom REST client, per Task 0 notes)
- Create: `src/lib/summaries-actions.ts` (`generateItemSummaries`)

**Interfaces:**
- Consumes: Fathom REST API (`FATHOM_API_KEY`); Claude (`@anthropic-ai/sdk`, `ANTHROPIC_API_KEY`); `rocks` + open/carried `ids_items`.
- Produces: `generateItemSummaries(year: number, week: number): Promise<{ generated: number; skipped: string[] }>` — upserts one `item_summaries` row per recurring item; returns a count + reasons for any skips (e.g. "no transcript for week").

- [ ] **Step 1: Add the SDK dependency**

```bash
npm install @anthropic-ai/sdk
git add package.json package-lock.json
git commit -m "chore: add @anthropic-ai/sdk for AI summaries"
```

- [ ] **Step 2: Fathom client (code against Task 0 notes)**

Create `src/lib/fathom.ts` implementing exactly the endpoints Task 0 recorded — a `listRecordings(fromISO, toISO)` and `getTranscript(recordingId)` — using `fetch` with the `FATHOM_API_KEY` auth header from the notes. Export `fathomConfigured(): boolean` (`!!process.env.FATHOM_API_KEY`). Throw a clear error on non-2xx. (Do not invent endpoints — use the verified shapes; if Task 0 found no API, this file is not created and Task 4 is skipped.)

- [ ] **Step 3: Generation action**

Create `src/lib/summaries-actions.ts`:
```ts
"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { createClient } from "./supabase-server";
import { isoWeekStart } from "./weekly";
import { fathomConfigured, listRecordings, getTranscript } from "./fathom";

export async function generateItemSummaries(
  year: number,
  week: number
): Promise<{ generated: number; skipped: string[] }> {
  if (!fathomConfigured() || !process.env.ANTHROPIC_API_KEY) {
    throw new Error("Summaries need FATHOM_API_KEY and ANTHROPIC_API_KEY configured in the deployment.");
  }
  const supabase = createClient();
  const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY

  // Week date bounds (end exclusive).
  const start = isoWeekStart(year, week);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  const fromISO = start.toISOString();
  const toISO = end.toISOString();

  const recordings = await listRecordings(fromISO, toISO);
  if (recordings.length === 0) return { generated: 0, skipped: ["no Fathom recordings in week"] };
  const transcripts = (await Promise.all(recordings.map((r) => getTranscript(r.id)))).join("\n\n");

  // Recurring items: this quarter's rocks + open/carried issues.
  const [{ data: rocks }, { data: issues }] = await Promise.all([
    supabase.from("rocks").select("id, title"),
    supabase.from("ids_items").select("id, issue").eq("archived", false)
  ]);

  const items: { item_type: "rock" | "ids"; item_id: number; label: string }[] = [
    ...(rocks ?? []).map((r) => ({ item_type: "rock" as const, item_id: r.id, label: r.title })),
    ...(issues ?? []).map((i) => ({ item_type: "ids" as const, item_id: i.id, label: i.issue }))
  ];

  const skipped: string[] = [];
  let generated = 0;
  for (const it of items) {
    const msg = await anthropic.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content:
          `From this meeting transcript, write a 1-2 sentence recap of what was ` +
          `discussed or decided about the following item. If it was not mentioned, ` +
          `reply exactly "Not discussed."\n\nItem: ${it.label}\n\nTranscript:\n${transcripts}`
      }]
    });
    const text = msg.content.find((b) => b.type === "text");
    const summary = text && "text" in text ? text.text.trim() : "";
    if (!summary || summary === "Not discussed.") { skipped.push(it.label); continue; }

    const { error } = await supabase.from("item_summaries").upsert(
      {
        item_type: it.item_type,
        item_id: it.item_id,
        week_number: week,
        year_number: year,
        summary,
        source_ref: recordings.map((r) => r.id).join(",")
      },
      { onConflict: "item_type,item_id,week_number,year_number" }
    );
    if (error) throw new Error(error.message);
    generated++;
  }
  revalidatePath("/weekly");
  return { generated, skipped };
}
```

- [ ] **Step 4: Verify** — `npm run typecheck && npm run build` PASS. (Build compiles the action; it only runs at request time, so no live keys are needed to build.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/fathom.ts src/lib/summaries-actions.ts
git commit -m "feat: Fathom client + generateItemSummaries (env-guarded, idempotent)"
```

---

### Task 5: Fathom-flagged → Backlog extraction

**Files:**
- Modify: `src/lib/summaries-actions.ts` (add `extractBacklogFromFathom`)

**Interfaces:**
- Consumes: same Fathom transcripts; existing `backlog_items` (Phase 2).
- Produces: `extractBacklogFromFathom(year, week): Promise<{ inserted: number }>` — inserts parking-lot / future-client items with `source='fathom'`, `source_ref=<recording ids>`, deduped.

- [ ] **Step 1: Add the extraction action**

Append to `src/lib/summaries-actions.ts` a `extractBacklogFromFathom(year, week)` that: gathers the same week's transcripts (reuse the recordings→transcript logic — factor a small private `weekTranscripts(year, week)` helper both functions call to avoid duplication); asks Claude for a JSON array of `{title, detail}` parking-lot / backlog / future-client items using structured output (`output_config: { format: { type: "json_schema", schema: {...} } }` with `additionalProperties:false`, `required`); reads existing open `backlog_items` titles; inserts only new ones with `source: "fathom"`, `source_ref`, deduping on normalized title (`trim().toLowerCase()`) not already present. Return `{ inserted }`. `revalidatePath("/weekly")`.

- [ ] **Step 2: Verify** — `npm run typecheck && npm run build` PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/summaries-actions.ts
git commit -m "feat: extract Fathom-flagged backlog items (source=fathom, deduped)"
```

---

### Task 6: Wire into the /admin panel + weekly refresh

**Files:**
- Modify: `src/components/admin-panel.tsx` (add a "Refresh AI summaries" card)

**Interfaces:**
- Consumes: `generateItemSummaries`, `extractBacklogFromFathom`.
- Produces: an operator control that runs both for the current ISO week and reports counts; surfaces the "credentials not configured" error inline.

- [ ] **Step 1: Add the card**

Add a third card to `admin-panel.tsx`, "Refresh AI summaries (this week)", following the existing card pattern (its own `useState`/`useTransition`, `applyingRef` re-entry guard, try/catch → red error note). On click it computes the current ISO week (import the same `currentIsoWeek` helper the board uses), calls `generateItemSummaries(year, week)` then `extractBacklogFromFathom(year, week)`, and shows "Generated N summaries, inserted M backlog items (skipped K)". No dry-run needed — it's non-destructive (upsert + dedup insert) — but keep the re-entry guard so a double-click can't double-run.

- [ ] **Step 2: Verify** — `npm run typecheck && npm run lint && npm run build` PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin-panel.tsx
git commit -m "feat(admin): refresh AI summaries + Fathom backlog for the current week"
```

---

### Task 7: Operator run (live)

**Files:** none. Run by Daniel.

- [ ] **Step 1:** Apply `015_item_summaries.sql` in the Supabase SQL editor.
- [ ] **Step 2:** Set `FATHOM_API_KEY` and `ANTHROPIC_API_KEY` in the Vercel project env; redeploy.
- [ ] **Step 3:** On `/admin`, run "Refresh AI summaries"; confirm rock cards / IDS rows show "Last meeting: …" on `/weekly` and Fathom items appear in Backlog. If keys are absent, confirm the panel shows the "credentials not configured" message rather than erroring the board.

---

## Self-Review

**Spec coverage (Phase 3):**
- `item_summaries` cache + migration → Task 1 ✅
- Types + snapshot + inline display → Tasks 2–3 ✅
- Fathom transcript pull + Claude summary, idempotent, env-guarded → Task 4 ✅ (gated on Task 0 verifying Fathom's API)
- Fathom-flagged → backlog, deduped → Task 5 ✅
- Operator trigger + graceful degrade → Tasks 6–7 ✅

**Placeholder scan:** Migration, types, summary lib, and `generateItemSummaries` carry complete code. `fathom.ts` (Task 4 Step 2) and `extractBacklogFromFathom` (Task 5) are described against verified interfaces rather than fully coded, because their exact shape depends on Task 0's findings (Fathom's real API) — coding them before that is guessing. This is deliberate and flagged, not an omission.

**Type consistency:** `ItemSummary` is a `Tables<>` alias; `summaryKey`/`indexSummaries` used identically in Tasks 2–3; the Claude call matches the SDK (`claude-opus-4-8`, narrow `content` by `type === "text"`); `generateItemSummaries`/`extractBacklogFromFathom` signatures match the `/admin` caller.

**Hard dependency:** Task 0 is a gate. If Fathom exposes no REST API for this workspace, Tasks 1–3 (schema + display) still ship and summaries are populated another way; Tasks 4–6 wait. This is called out at the top of the plan, not buried.

**Out of scope:** Real-time/streamed generation, per-meeting (vs per-week) granularity, and summarizing one-off (non-recurring) items.
