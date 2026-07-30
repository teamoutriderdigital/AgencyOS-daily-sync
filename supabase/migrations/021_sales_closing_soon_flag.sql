-- A per-deal "we expect this to close soon" flag for the Sales pipeline.
--
-- The closing-soon filter (migration 020 era) keyed only off expected_close,
-- which forced the team to commit to an exact day just to get a deal into the
-- view. That's the wrong unit: at a daily sync the honest answer is usually
-- "this one's close", not "this closes on the 14th". This column captures that
-- judgment in one click, and the filter matches a flagged deal OR one whose
-- expected_close falls inside the window — either route works.
--
-- Not null with a false default so every existing row is simply "not flagged"
-- and the UI never has to reason about a third, null state.
--
-- No enum/RLS/realtime changes: the column rides on the existing sales_deals
-- table, already published to realtime in migration 016, so flag changes stream
-- live to every open board like any other field. Idempotent — safe to re-run.

alter table sales_deals add column if not exists closing_soon boolean not null default false;

-- Partial index: the filter only ever asks for the flagged rows, and they're the
-- small minority of the table.
create index if not exists sales_deals_closing_soon_idx
  on sales_deals (closing_soon) where closing_soon;

-- Sanity check after running:
--   select count(*) from sales_deals where closing_soon;  -- expect 0 (nothing flagged yet)
