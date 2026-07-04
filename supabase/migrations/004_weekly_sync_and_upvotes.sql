-- Weekly L10 view: topic upvotes + ISO-week tracking + carryover engine.
--
-- Adds to the existing ids_items / action_items tables (no new tables):
--   • upvotes            — /submit topics and IDS issues can be upvoted; the
--                          weekly board sorts by votes first.
--   • week_number/year_number — the ISO week an item belongs to. Auto-stamped on
--                          insert by a trigger so the weekly board can filter.
--   • carried_from_week  — set when the carryover engine rolls a still-open item
--                          forward, so the UI can show a "Week N Carryover" badge.
--
-- Plus two RPCs: sync_weekly_pending_items() (the carryover engine) and
-- upvote_ids_item() (atomic increment). Idempotent — safe to re-run.

-- ─── Columns ────────────────────────────────────────────────────────────────

alter table ids_items    add column if not exists upvotes int not null default 0;

alter table ids_items    add column if not exists week_number int;
alter table ids_items    add column if not exists year_number int;
alter table ids_items    add column if not exists carried_from_week int;

alter table action_items add column if not exists week_number int;
alter table action_items add column if not exists year_number int;
alter table action_items add column if not exists carried_from_week int;

create index if not exists ids_items_week_idx    on ids_items(year_number, week_number);
create index if not exists action_items_week_idx on action_items(year_number, week_number);

-- ─── Auto-stamp the ISO week/year on insert ─────────────────────────────────
-- extract(week ...) is the ISO 8601 week; extract(isoyear ...) the matching
-- ISO year (they diverge from the calendar year at year boundaries).

create or replace function set_item_week_year()
returns trigger as $$
begin
  if new.week_number is null then
    new.week_number := extract(week from now())::int;
  end if;
  if new.year_number is null then
    new.year_number := extract(isoyear from now())::int;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists ids_items_set_week on ids_items;
create trigger ids_items_set_week before insert on ids_items
  for each row execute function set_item_week_year();

drop trigger if exists action_items_set_week on action_items;
create trigger action_items_set_week before insert on action_items
  for each row execute function set_item_week_year();

-- ─── Carryover engine ───────────────────────────────────────────────────────
-- Roll every still-open item from a prior week (or an unstamped legacy row)
-- forward into (target_year, target_week), recording where it came from so the
-- board can badge it. Open = ids not archived / action not done.

create or replace function sync_weekly_pending_items(target_year int, target_week int)
returns void as $$
begin
  update ids_items
     set carried_from_week = week_number,
         year_number       = target_year,
         week_number       = target_week
   where archived = false
     and ( year_number is null
        or year_number <  target_year
        or (year_number = target_year and week_number < target_week) );

  update action_items
     set carried_from_week = week_number,
         year_number       = target_year,
         week_number       = target_week
   where done = false
     and ( year_number is null
        or year_number <  target_year
        or (year_number = target_year and week_number < target_week) );
end;
$$ language plpgsql;

-- ─── Atomic upvote ──────────────────────────────────────────────────────────

create or replace function upvote_ids_item(item_id int)
returns void as $$
begin
  update ids_items set upvotes = upvotes + 1 where id = item_id;
end;
$$ language plpgsql;
