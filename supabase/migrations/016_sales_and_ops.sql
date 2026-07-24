-- Daily board additions: a lightweight Sales pipeline ("deals we're about to
-- do") and an Ops task list. Both are MASTER tables (not date-scoped) — they
-- persist across days like action_items, and stream live via realtime. Same
-- open-RLS + realtime + touch shape as the rest of the schema.

-- ─── Enums ──────────────────────────────────────────────────────────────────

do $$ begin
  create type sales_stage as enum ('Lead', 'Proposal', 'Verbal', 'Won', 'Lost');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ops_status as enum ('Open', 'In progress', 'Blocked', 'Done');
exception when duplicate_object then null; end $$;

-- ─── sales_deals (pipeline) ─────────────────────────────────────────────────

create table if not exists sales_deals (
  id serial primary key,
  name text not null default '',
  value numeric,
  stage sales_stage not null default 'Lead',
  owner team_member,
  expected_close date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sales_deals_stage_idx on sales_deals(stage);
create index if not exists sales_deals_close_idx on sales_deals(expected_close);

drop trigger if exists sales_deals_touch on sales_deals;
create trigger sales_deals_touch before update on sales_deals
  for each row execute function touch_updated_at();

alter table sales_deals enable row level security;
drop policy if exists "open_sales_deals" on sales_deals;
create policy "open_sales_deals" on sales_deals for all using (true) with check (true);

-- ─── ops_tasks (operations to-do) ───────────────────────────────────────────

create table if not exists ops_tasks (
  id serial primary key,
  title text not null default '',
  owner team_member,
  status ops_status not null default 'Open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ops_tasks_status_idx on ops_tasks(status);
create index if not exists ops_tasks_owner_idx on ops_tasks(owner);

drop trigger if exists ops_tasks_touch on ops_tasks;
create trigger ops_tasks_touch before update on ops_tasks
  for each row execute function touch_updated_at();

alter table ops_tasks enable row level security;
drop policy if exists "open_ops_tasks" on ops_tasks;
create policy "open_ops_tasks" on ops_tasks for all using (true) with check (true);

-- ─── Realtime ───────────────────────────────────────────────────────────────

do $$
declare pub_exists boolean;
begin
  select exists(select 1 from pg_publication where pubname = 'supabase_realtime') into pub_exists;
  if pub_exists then
    begin alter publication supabase_realtime add table sales_deals; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table ops_tasks; exception when duplicate_object then null; end;
  end if;
end $$;
