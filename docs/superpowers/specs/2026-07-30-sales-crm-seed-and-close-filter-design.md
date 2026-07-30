# Sales pipeline: CRM company seed + "closing soon" filter

Date: 2026-07-30

## Problem

Two gaps in the Sales section (added in migration 016, rendered on the daily board):

1. The pipeline holds 5 rows, 3 of which are informal notes rather than companies
   (`Open loop`, `Kale`, `Conal (cold email) Follow up sent`). Meanwhile a CRM
   export (`opportunity.csv`, 37 opportunities) lists the companies actually in
   play. None of them are on the board, so the L10 reviews an incomplete pipeline.
2. There is no way to see which deals are near closing. The only filter is
   "Show closed", which is the opposite question. With 38 rows the section
   becomes a wall of text and the near-term deals get lost in it.

The Sales section is also only on the daily board, so it's absent from the
weekly L10 where pipeline gets reviewed as a group.

## Scope

Three changes, all additive:

1. Seed the CRM companies into `sales_deals` — company name only.
2. Add a "closing soon" filter to `SalesSection`.
3. Render `SalesSection` on the weekly L10 board as well as the daily board.

Out of scope: no ongoing CRM sync (this is a one-time seed), no schema change
for the filter, no changes to the Ops section.

## 1. Company seed — `supabase/migrations/020_seed_sales_deals_from_crm.sql`

Follows the seed convention of `006_client_stages.sql`: plain `insert`s at the
end of a migration, idempotent, safe to re-run.

### Name derivation

The CSV `Name` column packs company, engagement and contact into one string
(`Thermal Guardian — PPC + Website + Landing Page Revival (Kwame Poku)`). Only
the company name is wanted, so the name is the text before the em dash. Nine
rows have no em dash and are mapped by hand:

| CSV row | Company |
|---|---|
| `COD affiliate partnership (lead-gen for coaching masterclass)` | COD |
| `COD YouTube content retainer (via Marin / 2Way Studios)` | COD |
| `Vital 'AI Mission Vital' systems build + website` | Vital |
| `Imagine Harmony website rebuild` | Imagine Harmony |
| `Leke Services Google Ads / PPC` | Leke Services |
| `Catalyst Crew recruiting-platform JV` | Catalyst Crew |
| `AgencyOS 'Work for free for a week' high-ticket offer (GTM motion)` | AgencyOS |
| `AOC XFA landing-page rebuild (WS4)` | AOC |
| `Free Week System license to Outrider` | Outrider |

### Deduplication

Rows are grouped by CSV `Company Id`, so one company yields one row regardless
of how many opportunities it has. This collapses 37 rows to 35 companies. The
only multi-row group is `112b8f08`, covering `AJ Harbinger x Russ`,
`COD affiliate partnership` and `COD YouTube content retainer` — inserted once
as **`COD`**, the client code already used elsewhere in the repo (migration 006
seeds a `COD` client; `PLANE-TASK-PROCESS.md` lists `COD` as an identifier).

`Acquisition Stars (AJ)` carries a different `Company Id` (`e0f041dd`) and stays
a separate row despite the shared contact.

Two of the 35 are already in `sales_deals` and are skipped, leaving **33
inserts**:

- `Vital` — exact match on existing row.
- `Project Eros` — existing row is `Project Eros (Daniel Hall)`.

`Ecom Luxx` (contact: Conal Brady) is very likely the same deal as the existing
`Conal (cold email) Follow up sent` row, but the names don't match, so it is
inserted under its real company name and the collision is called out in a
migration comment for manual cleanup at the L10. Deleting an existing row on an
inferred match is the team's call, not the migration's.

### Field values

Name and stage only. `stage` takes the table default `'Lead'`; `value`, `owner`,
`expected_close` and `notes` are left null.

Close dates are deliberately **not** imported. Only 5 of 37 rows carry one and
all 5 are in the past (`2026-05-20` … `2026-06-24`, against a current date of
`2026-07-30`), so importing them would mark a third of the seeded pipeline
overdue on day one. Dates get set on the board as deals are reviewed.

### Idempotency

`sales_deals` has no unique index on `name`, so `on conflict` is unavailable.
Each insert is guarded instead:

```sql
insert into sales_deals (name)
select 'Brand Breakthrough'
where not exists (select 1 from sales_deals where lower(name) = lower('Brand Breakthrough'));
```

Case-insensitive, matching the `clients_name_key` convention. Re-running the
migration inserts nothing, and it will not duplicate rows a user has already
added by hand.

## 2. Closing-soon filter — `src/components/sales-section.tsx`

A `closingSoon` boolean, rendered in `rightSlot` beside the existing
"Show closed" checkbox, with a live count of matching deals.

### Predicate

A deal matches when it has an `expected_close` on or before `today + 30 days`.
There is no lower bound: an already-passed close date still matches, so a deal
that slipped stays visible rather than silently dropping out of the view meant
to catch it. Deals with no `expected_close` never match.

Two helpers in `src/lib/sales.ts`, next to the existing `isOpenDeal`:

- `isClosingSoon(deal, today)` — the predicate above.
- `isOverdue(deal, today)` — `expected_close` strictly before today. Used only
  for styling.

Both take today's date as an argument rather than reading the clock, so they're
directly testable and the component computes "today" once per render.

### Composition with "Show closed"

The two filters intersect: `closingSoon` narrows by date, `showClosed` decides
whether `Won`/`Lost` are in scope at all. A won deal with a date inside the
window appears only when "Show closed" is also on. Neither toggle overrides the
other, so no new state interactions to reason about.

### Sorting and styling

While `closingSoon` is on, rows sort by `expected_close` ascending — soonest
(and overdue) first — replacing the default stage-rank sort, since date is the
axis being filtered on. Overdue dates render red in the date input's row
regardless of whether the filter is on, so the signal exists in the unfiltered
view too.

### Empty state

Because dates import blank, the filter legitimately matches nothing at first. A
generic "no deals" message would read as a bug, so the empty state is specific:
it says no deals have a close date within 30 days and points at the date field.

## 3. Weekly L10 board

`SalesSection` is self-contained — it takes `deals` and calls the server actions
itself — so mirroring it means rendering the same component on the weekly board.
It stays **editable** there, matching how client headlines became editable on
the weekly board in `b232e9e`. A read-only variant would mean a second code path
for no benefit.

Wiring, following the pattern the other weekly lists already use:

- `weekly-server.ts`: add `salesDeals` to `WeeklySnapshot` and `emptySnapshot()`,
  and a `sales_deals` select to the existing `Promise.all`, ordered
  `created_at` ascending to match the daily board. Error handling is non-fatal
  (`console.error`, fall back to `[]`) like `innovations` and `backlogItems`, so
  a board without migration 016 applied still renders.
- `weekly-board.tsx`: hold `salesDeals` in state, subscribe to a
  `weekly:sales_deals` realtime channel mirroring `daily:sales_deals` in
  `daily-board.tsx`, and render `<SalesSection deals={salesDeals} />`.
- `sales-actions.ts`: `revalidateDaily()` becomes `revalidateSales()`, calling
  `revalidatePath` for both `/daily` and `/weekly`. Without this, an edit made
  on one board leaves the other's cached render stale.

Placement: after `ActionItemsSection` (to-dos) and before
`RocksTrackerSection`, so pipeline is reviewed with the operational lists rather
than among the quarterly rocks.

## Testing

The repo has no test harness, so verification is by build plus manual check:

- `npx tsc --noEmit` and `next build` clean.
- Migration runs clean in the Supabase SQL editor; a second run inserts nothing
  (`select count(*) from sales_deals` unchanged at 38).
- `select name from sales_deals order by id` shows the 5 original rows and 33
  seeded companies, with no `Vital` or `Project Eros` duplicate.
- On both boards: toggling the filter with all dates blank shows the specific
  empty state; setting one deal's close date to ~2 weeks out makes it the only
  row shown, with the header count at 1; backdating a deal keeps it visible with
  a red date; a stage or owner edit on one board appears on the other.

## Risks

- **Filter reads empty on day one.** Expected, not a defect — no seeded deal has
  a date. Mitigated by the specific empty-state copy. Worth saying out loud at
  the L10 so it isn't reported as a bug.
- **33 rows lands the pipeline at 38.** The section grows long and unsorted
  companies sit under `Lead`. Acceptable: the filter and "Show closed" exist to
  cut it down, and triaging stages is the point of putting them on the board.
- **Name derivation is heuristic.** An em-dash split plus a 9-row manual map
  can produce an awkward name (`Kyroc / Vujis`, `HDL free-audit pipeline`).
  Names are editable inline on the board, so a wrong one is a one-click fix.
- **One-time seed, not a sync.** The board and the CRM will drift. Out of scope
  here; a recurring sync would need a stable external id on `sales_deals`.
