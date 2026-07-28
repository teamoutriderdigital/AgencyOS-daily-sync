-- Add a free-text notes field to each sales lead. Idempotent — safe to re-run.
-- No enum/RLS/realtime changes: the column rides on the existing sales_deals
-- table (already published to realtime in migration 016), so note edits stream
-- live like every other field.

alter table sales_deals add column if not exists notes text;
