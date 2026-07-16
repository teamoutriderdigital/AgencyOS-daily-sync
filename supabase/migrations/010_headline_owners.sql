-- Owners on client headlines: a client-level owner on each headline, plus a
-- per-bullet task list where each task can have its own owner.
--
-- daily_headlines gains an `owner` (the client-level lead). Each bullet becomes
-- a row in headline_tasks (denormalized `headline_date` so it filters/streams
-- like the other date-scoped tables). Owners draw from the team_member enum.
-- Permissive RLS — protect at the deployment layer. Idempotent — safe to re-run.

alter table daily_headlines add column if not exists owner team_member;

create table if not exists headline_tasks (
  id serial primary key,
  headline_id integer not null references daily_headlines(id) on delete cascade,
  headline_date date not null,
  text text not null,
  owner team_member,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists headline_tasks_headline_idx on headline_tasks(headline_id);
create index if not exists headline_tasks_date_idx on headline_tasks(headline_date desc);
create index if not exists headline_tasks_sort_idx on headline_tasks(headline_id, sort_order, created_at);

-- touch_updated_at() is defined in migration 006.
drop trigger if exists headline_tasks_touch on headline_tasks;
create trigger headline_tasks_touch before update on headline_tasks
  for each row execute function touch_updated_at();

alter table headline_tasks enable row level security;
drop policy if exists "open_headline_tasks" on headline_tasks;
create policy "open_headline_tasks" on headline_tasks for all using (true) with check (true);

-- Realtime so task/owner edits stream live during the standup.
do $$
declare
  pub_exists boolean;
begin
  select exists(select 1 from pg_publication where pubname = 'supabase_realtime') into pub_exists;
  if pub_exists then
    begin alter publication supabase_realtime add table headline_tasks; exception when duplicate_object then null; end;
  end if;
end $$;
