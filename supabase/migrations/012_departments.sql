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
