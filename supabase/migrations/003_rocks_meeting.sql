-- Quarterly Rocks — Finalize & Assign meeting board.
--
-- A one-off decision-meeting surface bolted onto the daily board (route
-- `/rocks`). Unlike the daily standup, this is shared live state with no date
-- scope: the whole team edits the same rocks, decisions, and checklist together
-- during the sync. Two tables:
--
--   rocks           — the deliverable: one finalized rock per row (owner, type,
--                     "done" sentence, deadline). Owner is free text because the
--                     rocks roster (Darko, Mustafa) is wider than the daily
--                     team_member enum.
--   rock_meeting_kv — everything else the meeting locks, as a keyed store: the
--                     four decisions, the ownership-collision resolutions, the
--                     exit checklist, and the facilitator name. `text_value`
--                     holds the written call; `checked` holds locked/done.
--
-- Same access model as 001: permissive RLS for the anon key, protect at the
-- deployment layer. Idempotent — safe to re-run.

-- ─── Enum ───────────────────────────────────────────────────────────────────

do $$ begin
  create type rock_type as enum ('company', 'individual');
exception when duplicate_object then null;
end $$;

-- ─── updated_at trigger function (create-or-replace so 003 can run alone) ────

create or replace function touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ─── rocks (the finalized deliverable) ──────────────────────────────────────

create table if not exists rocks (
  id serial primary key,
  title text not null default '',
  owner text,
  rock_type rock_type not null default 'company',
  smart text,
  deadline date,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rocks_sort_idx on rocks(sort_order, created_at);

-- ─── rock_meeting_kv (decisions, collisions, checklist, facilitator) ────────
-- Keyed by a stable string the UI owns (e.g. 'decision:cadence',
-- 'collision:onboarding', 'checklist:cadence', 'facilitator'). Partial upserts
-- touch only text_value or checked, so locking a card never clears its text.

create table if not exists rock_meeting_kv (
  key text primary key,
  text_value text,
  checked boolean not null default false,
  updated_at timestamptz not null default now()
);

-- ─── updated_at triggers ────────────────────────────────────────────────────

drop trigger if exists rocks_touch on rocks;
create trigger rocks_touch before update on rocks
  for each row execute function touch_updated_at();

drop trigger if exists rock_meeting_kv_touch on rock_meeting_kv;
create trigger rock_meeting_kv_touch before update on rock_meeting_kv
  for each row execute function touch_updated_at();

-- ─── RLS (permissive — internal tool) ───────────────────────────────────────

alter table rocks enable row level security;
alter table rock_meeting_kv enable row level security;

drop policy if exists "open_rocks" on rocks;
create policy "open_rocks" on rocks for all using (true) with check (true);

drop policy if exists "open_rock_meeting_kv" on rock_meeting_kv;
create policy "open_rock_meeting_kv" on rock_meeting_kv for all using (true) with check (true);

-- ─── Realtime ───────────────────────────────────────────────────────────────

do $$
declare
  pub_exists boolean;
begin
  select exists(select 1 from pg_publication where pubname = 'supabase_realtime') into pub_exists;
  if pub_exists then
    begin alter publication supabase_realtime add table rocks; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table rock_meeting_kv; exception when duplicate_object then null; end;
  end if;
end $$;
