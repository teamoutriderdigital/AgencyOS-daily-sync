-- Weekly Rock tracker: add a status + quarter to the existing rocks table.
--
-- The rocks set in the Finalize & Assign meeting (migration 003) become the
-- rows tracked weekly. Rather than a parallel table, we add:
--   • status  — On track / Off track / Done, toggled each week at the L10.
--   • quarter — which quarter the rock belongs to (defaults to the live one).
-- Owner stays free text (the rocks roster is wider than the team_member enum:
-- it includes Darko and Mostafa). Idempotent — safe to re-run.

do $$ begin
  create type rock_status as enum ('On track', 'Off track', 'Done');
exception when duplicate_object then null;
end $$;

alter table rocks add column if not exists status  rock_status not null default 'On track';
alter table rocks add column if not exists quarter text        not null default 'Q3 2026';

create index if not exists rocks_quarter_idx on rocks(quarter);
