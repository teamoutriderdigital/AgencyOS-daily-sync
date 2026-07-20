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
