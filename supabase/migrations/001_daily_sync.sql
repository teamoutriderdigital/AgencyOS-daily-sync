-- Daily Sync Board — standalone schema.
--
-- This is the standalone version of the daily board: it does NOT share tables
-- with the GrowthArchon weekly L10 (there is no shared database here), so it
-- carries its own copies of action_items + ids_items alongside the daily-only
-- check-in and headline tables.
--
-- Access model: this is a small internal team tool with no auth layer. RLS is
-- ENABLED with a permissive policy so the anon key can read/write. Protect
-- access at the deployment layer (Vercel password protection, private network,
-- etc.). To lock it down later, replace the permissive policies with a real
-- auth check.

-- ─── Enums ──────────────────────────────────────────────────────────────────

do $$ begin
  create type team_member as enum ('Jack', 'Daniel', 'Leonardo', 'Rehan', 'Kas');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type l10_priority as enum ('High', 'Medium', 'Low');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type ids_status as enum ('Not started', 'Block', 'In progress', 'Solved');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type attendance_status as enum ('Present', 'Out');
exception when duplicate_object then null;
end $$;

-- ─── updated_at trigger function ────────────────────────────────────────────

create or replace function touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ─── action_items (to-dos) ──────────────────────────────────────────────────

create table if not exists action_items (
  id serial primary key,
  item text not null,
  assignee team_member,
  due_date date,
  priority l10_priority,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists action_items_done_idx on action_items(done) where done = false;
create index if not exists action_items_assignee_idx on action_items(assignee);
create index if not exists action_items_due_idx on action_items(due_date);

-- ─── ids_items (issues / IDS) ───────────────────────────────────────────────

create table if not exists ids_items (
  id serial primary key,
  issue text not null,
  owner team_member,
  status ids_status not null default 'Not started',
  priority l10_priority,
  client_internal text[] not null default '{}',
  due_date date,
  identify text,
  discuss text,
  solve text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ids_items_archived_idx on ids_items(archived) where archived = false;
create index if not exists ids_items_owner_idx on ids_items(owner);
create index if not exists ids_items_due_idx on ids_items(due_date);

-- ─── daily_checkins ─────────────────────────────────────────────────────────
-- Attendance per (day, member): status = Present / Remote / Out (null = not
-- marked yet). `mood` is an optional one-line note kept for future use. Editing
-- upserts on the unique constraint; it never inserts a duplicate.

create table if not exists daily_checkins (
  id serial primary key,
  checkin_date date not null,
  member team_member not null,
  status attendance_status,
  mood text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (checkin_date, member)
);

create index if not exists daily_checkins_date_idx on daily_checkins(checkin_date desc);

-- ─── daily_headlines ────────────────────────────────────────────────────────
-- One-line client news for a given day. `client` is free-form text.

create table if not exists daily_headlines (
  id serial primary key,
  headline_date date not null,
  client text,
  text text not null,
  created_by team_member,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists daily_headlines_date_idx on daily_headlines(headline_date desc);

-- ─── updated_at triggers ────────────────────────────────────────────────────

drop trigger if exists action_items_touch on action_items;
create trigger action_items_touch before update on action_items
  for each row execute function touch_updated_at();

drop trigger if exists ids_items_touch on ids_items;
create trigger ids_items_touch before update on ids_items
  for each row execute function touch_updated_at();

drop trigger if exists daily_checkins_touch on daily_checkins;
create trigger daily_checkins_touch before update on daily_checkins
  for each row execute function touch_updated_at();

drop trigger if exists daily_headlines_touch on daily_headlines;
create trigger daily_headlines_touch before update on daily_headlines
  for each row execute function touch_updated_at();

-- ─── RLS (permissive — internal tool) ───────────────────────────────────────

alter table action_items enable row level security;
alter table ids_items enable row level security;
alter table daily_checkins enable row level security;
alter table daily_headlines enable row level security;

drop policy if exists "open_action_items" on action_items;
create policy "open_action_items" on action_items for all using (true) with check (true);

drop policy if exists "open_ids_items" on ids_items;
create policy "open_ids_items" on ids_items for all using (true) with check (true);

drop policy if exists "open_daily_checkins" on daily_checkins;
create policy "open_daily_checkins" on daily_checkins for all using (true) with check (true);

drop policy if exists "open_daily_headlines" on daily_headlines;
create policy "open_daily_headlines" on daily_headlines for all using (true) with check (true);

-- ─── Realtime ───────────────────────────────────────────────────────────────
-- So two members in the board during the sync see each other's edits live.

do $$
declare
  pub_exists boolean;
begin
  select exists(select 1 from pg_publication where pubname = 'supabase_realtime') into pub_exists;
  if pub_exists then
    begin alter publication supabase_realtime add table action_items; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table ids_items; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table daily_checkins; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table daily_headlines; exception when duplicate_object then null; end;
  end if;
end $$;
