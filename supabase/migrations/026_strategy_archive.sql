-- Strategy-board archive flag on clients. Archiving hides a client's card on
-- /strategy without touching its lifecycle stage on the weekly tracker — the
-- two views answer different questions ("are we meeting monthly?" vs "where
-- are they in the pipeline?"). Idempotent — safe to re-run.

alter table clients add column if not exists strategy_archived boolean not null default false;
