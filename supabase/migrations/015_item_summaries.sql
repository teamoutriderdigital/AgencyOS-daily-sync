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
