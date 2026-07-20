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
