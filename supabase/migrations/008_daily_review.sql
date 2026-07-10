-- Daily "Items to review for the day" — a per-day editable checklist on the
-- daily board, sitting between Client headlines and To-dos.
--
-- Date-scoped like daily_checkins / daily_headlines: each item belongs to one
-- day and does NOT carry over (the standup starts each day with a fresh list).
-- `done` is the "reviewed" checkbox. `created_by` is optional (matches the
-- headlines convention). Permissive RLS — protect at the deployment layer.
-- Idempotent — safe to re-run.

create table if not exists daily_review_items (
  id serial primary key,
  review_date date not null,
  text text not null,
  done boolean not null default false,
  created_by team_member,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists daily_review_items_date_idx on daily_review_items(review_date desc);
create index if not exists daily_review_items_sort_idx on daily_review_items(review_date, sort_order, created_at);

-- touch_updated_at() is defined in migration 006.
drop trigger if exists daily_review_items_touch on daily_review_items;
create trigger daily_review_items_touch before update on daily_review_items
  for each row execute function touch_updated_at();

alter table daily_review_items enable row level security;
drop policy if exists "open_daily_review_items" on daily_review_items;
create policy "open_daily_review_items" on daily_review_items for all using (true) with check (true);

-- Realtime so two people in the board during the standup see edits live.
do $$
declare
  pub_exists boolean;
begin
  select exists(select 1 from pg_publication where pubname = 'supabase_realtime') into pub_exists;
  if pub_exists then
    begin alter publication supabase_realtime add table daily_review_items; exception when duplicate_object then null; end;
  end if;
end $$;
