-- Client numbers for the weekly L10 — one row per client per week.
--
-- Last full week's organic clicks, impressions, sessions, key events and
-- revenue, each with the same-days figure from the week before. Rows are
-- computed on a trusted machine (`npm run push:client-metrics`) from the
-- reporting warehouse, the Key Healthcare feed Sheet and the SBD revenue
-- export, then pushed here. The deployment only reads this table, so no
-- Google, warehouse or client credential is ever needed on Vercel — the same
-- posture as migration 027.
--
-- A client with nothing connected still gets a row (all metrics null, `note`
-- says why) so the gap stays visible on the board instead of vanishing.
--
-- Idempotent — safe to re-run.

create table if not exists client_metrics (
  -- "<client>:<week_start>" — a refresh upserts in place.
  id text primary key,
  client text not null,
  week_start date not null,
  week_end date not null,
  organic_clicks numeric,
  organic_clicks_prev numeric,
  impressions numeric,
  impressions_prev numeric,
  sessions numeric,
  sessions_prev numeric,
  key_events numeric,
  key_events_prev numeric,
  revenue numeric,
  revenue_prev numeric,
  -- Last day each source had data for. When it is before week_end, both weeks
  -- were cut to the same weekdays so the comparison stays like for like.
  organic_through date,
  traffic_through date,
  revenue_through date,
  -- Where the numbers came from, for the footnote ("warehouse", "sheet", …).
  source text not null default '',
  note text,
  sort_order integer not null default 0,
  fetched_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_metrics_week_idx on client_metrics(week_start desc, sort_order);

drop trigger if exists client_metrics_touch on client_metrics;
create trigger client_metrics_touch before update on client_metrics
  for each row execute function touch_updated_at();

alter table client_metrics enable row level security;
drop policy if exists "open_client_metrics" on client_metrics;
create policy "open_client_metrics" on client_metrics for all using (true) with check (true);

do $$
declare pub_exists boolean;
begin
  select exists(select 1 from pg_publication where pubname = 'supabase_realtime') into pub_exists;
  if pub_exists then
    begin alter publication supabase_realtime add table client_metrics; exception when duplicate_object then null; end;
  end if;
end $$;
