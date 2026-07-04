-- Client stages tracker (weekly L10) + client picker source for /submit.
--
-- A lightweight per-client lifecycle tracker: each client has a stage the team
-- sets at the weekly L10. The same table backs the "Client" option on the public
-- /submit form, so the client list is shared and stays in sync.
--
-- Owner is free text (matches the rocks roster convention). Permissive RLS —
-- protect at the deployment layer. Idempotent — safe to re-run.

do $$ begin
  create type client_stage as enum ('Onboarding', 'Active', 'At Risk', 'Delivered', 'Churned');
exception when duplicate_object then null;
end $$;

create or replace function touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists clients (
  id serial primary key,
  name text not null,
  stage client_stage not null default 'Onboarding',
  owner text,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Case-insensitive unique name so "Redstone" / "redstone" can't both exist.
create unique index if not exists clients_name_key on clients (lower(name));
create index if not exists clients_stage_idx on clients(stage);
create index if not exists clients_sort_idx on clients(sort_order, created_at);

drop trigger if exists clients_touch on clients;
create trigger clients_touch before update on clients
  for each row execute function touch_updated_at();

alter table clients enable row level security;
drop policy if exists "open_clients" on clients;
create policy "open_clients" on clients for all using (true) with check (true);

-- Seed the known clients (used previously as the headline/submit quick-picks).
insert into clients (name, sort_order)
values ('Redstone', 0), ('SBD', 1), ('COD', 2), ('Vital', 3)
on conflict do nothing;

-- Realtime so stage changes stream to everyone on the weekly board.
do $$
declare
  pub_exists boolean;
begin
  select exists(select 1 from pg_publication where pubname = 'supabase_realtime') into pub_exists;
  if pub_exists then
    begin alter publication supabase_realtime add table clients; exception when duplicate_object then null; end;
  end if;
end $$;
