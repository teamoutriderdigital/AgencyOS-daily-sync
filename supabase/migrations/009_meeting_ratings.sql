-- Meeting rating — the classic L10 close-out where each attendee rates the
-- meeting 1–10, and the team watches the average.
--
-- Date-scoped and one row per (day, member), same shape as daily_checkins:
-- setting a rating upserts on the unique key; clearing it deletes the row.
-- rating is constrained 1–10. Permissive RLS — protect at the deployment
-- layer. Idempotent — safe to re-run.

create table if not exists meeting_ratings (
  id serial primary key,
  rating_date date not null,
  member team_member not null,
  rating integer not null check (rating between 1 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rating_date, member)
);

create index if not exists meeting_ratings_date_idx on meeting_ratings(rating_date desc);

-- touch_updated_at() is defined in migration 006.
drop trigger if exists meeting_ratings_touch on meeting_ratings;
create trigger meeting_ratings_touch before update on meeting_ratings
  for each row execute function touch_updated_at();

alter table meeting_ratings enable row level security;
drop policy if exists "open_meeting_ratings" on meeting_ratings;
create policy "open_meeting_ratings" on meeting_ratings for all using (true) with check (true);

-- Realtime so ratings stream in live as people submit them during the close-out.
do $$
declare
  pub_exists boolean;
begin
  select exists(select 1 from pg_publication where pubname = 'supabase_realtime') into pub_exists;
  if pub_exists then
    begin alter publication supabase_realtime add table meeting_ratings; exception when duplicate_object then null; end;
  end if;
end $$;
