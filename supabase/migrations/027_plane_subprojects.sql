-- Client work snapshot — the "one row per subproject" table the boards read.
--
-- The rows are computed from Plane and pushed in from a trusted machine
-- (`npm run push:subprojects`), never fetched by the deployment. That keeps the
-- Plane API key off Vercel entirely: the site only ever reads this table, with
-- the same open RLS + realtime shape as the rest of the schema.
--
-- Idempotent — safe to re-run.

-- ─── plane_subprojects (one row per client subproject) ──────────────────────
-- `id` is the pusher's stable "<plane project id>:<subproject>" key, so a
-- refresh upserts in place and a row that disappears from Plane is deleted.

create table if not exists plane_subprojects (
  id text primary key,
  client text not null,
  subproject text not null,
  task text not null,
  reference text not null,
  owner text not null,
  status text not null,
  due_date date,
  task_updated_at timestamptz,
  url text not null,
  active_count integer not null default 0,
  overdue_count integer not null default 0,
  missing_dates integer not null default 0,
  fetched_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists plane_subprojects_client_idx on plane_subprojects(client);

drop trigger if exists plane_subprojects_touch on plane_subprojects;
create trigger plane_subprojects_touch before update on plane_subprojects
  for each row execute function touch_updated_at();

alter table plane_subprojects enable row level security;
drop policy if exists "open_plane_subprojects" on plane_subprojects;
create policy "open_plane_subprojects" on plane_subprojects for all using (true) with check (true);

-- ─── plane_snapshot_meta (single row: when, and what could not be read) ─────
-- Kept separate from the rows so the board can say "checked at HH:MM" even when
-- a push produced no rows at all, and so partial failures surface as warnings
-- instead of silently shrinking the table.

create table if not exists plane_snapshot_meta (
  id integer primary key default 1 check (id = 1),
  fetched_at timestamptz not null default now(),
  warnings text[] not null default '{}',
  pushed_by text,
  updated_at timestamptz not null default now()
);

insert into plane_snapshot_meta (id, fetched_at, warnings)
  values (1, now(), '{}')
  on conflict (id) do nothing;

drop trigger if exists plane_snapshot_meta_touch on plane_snapshot_meta;
create trigger plane_snapshot_meta_touch before update on plane_snapshot_meta
  for each row execute function touch_updated_at();

alter table plane_snapshot_meta enable row level security;
drop policy if exists "open_plane_snapshot_meta" on plane_snapshot_meta;
create policy "open_plane_snapshot_meta" on plane_snapshot_meta for all using (true) with check (true);

-- ─── Realtime ───────────────────────────────────────────────────────────────

do $$
declare pub_exists boolean;
begin
  select exists(select 1 from pg_publication where pubname = 'supabase_realtime') into pub_exists;
  if pub_exists then
    begin alter publication supabase_realtime add table plane_subprojects; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table plane_snapshot_meta; exception when duplicate_object then null; end;
  end if;
end $$;
