-- Client strategy meetings — one meeting per client per month, each carrying
-- free-text notes plus its own action items. Month-scoped the way the daily
-- tables are date-scoped: `month` is always the first day of the month.
-- Same open-RLS + realtime + touch shape as the rest of the schema.
-- Idempotent — safe to re-run.

-- ─── strategy_meetings (one per client per month) ───────────────────────────

create table if not exists strategy_meetings (
  id serial primary key,
  client text not null,
  month date not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client, month)
);

create index if not exists strategy_meetings_month_idx on strategy_meetings(month);

drop trigger if exists strategy_meetings_touch on strategy_meetings;
create trigger strategy_meetings_touch before update on strategy_meetings
  for each row execute function touch_updated_at();

alter table strategy_meetings enable row level security;
drop policy if exists "open_strategy_meetings" on strategy_meetings;
create policy "open_strategy_meetings" on strategy_meetings for all using (true) with check (true);

-- ─── strategy_actions (action items under a meeting) ────────────────────────
-- client + month are denormalized from the parent meeting so the board can
-- query and stream one month with a single filter, like headline_tasks does
-- with headline_date.

create table if not exists strategy_actions (
  id serial primary key,
  meeting_id integer not null references strategy_meetings(id) on delete cascade,
  client text not null,
  month date not null,
  text text not null,
  owner team_member,
  done boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists strategy_actions_meeting_idx on strategy_actions(meeting_id);
create index if not exists strategy_actions_month_idx on strategy_actions(month);

drop trigger if exists strategy_actions_touch on strategy_actions;
create trigger strategy_actions_touch before update on strategy_actions
  for each row execute function touch_updated_at();

alter table strategy_actions enable row level security;
drop policy if exists "open_strategy_actions" on strategy_actions;
create policy "open_strategy_actions" on strategy_actions for all using (true) with check (true);

-- ─── Realtime ───────────────────────────────────────────────────────────────

do $$
declare pub_exists boolean;
begin
  select exists(select 1 from pg_publication where pubname = 'supabase_realtime') into pub_exists;
  if pub_exists then
    begin alter publication supabase_realtime add table strategy_meetings; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table strategy_actions; exception when duplicate_object then null; end;
  end if;
end $$;
