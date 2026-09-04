-- Pull-forward for the daily board's client headlines.
--
-- The weekly carryover (migration 004) MOVES master rows forward by re-stamping
-- week_number. Daily headlines can't work that way: they're date-scoped records
-- of what was said on a given day, and rewriting headline_date would erase that
-- history. So this COPIES instead — yesterday's board stays exactly as it was.
--
-- Without this the team hand-typed a "↩" prefix to mark carried items, which is
-- why so many task rows already start with one.
--
-- Source day is the most recent PRIOR day that actually has headlines, not
-- literally target - 1: the team skips weekends and quiet days (e.g. 7/28 → 7/30),
-- and "yesterday" on a Monday should mean Friday's board.
--
-- Only unfinished tasks come across, with their owner and sort_order intact.
-- Completed ones stay behind as the record of what got done that day.
--
-- Idempotent in the way that matters: if the target day already has ANY
-- headline, this is a no-op. That makes the button safe to double-click and
-- stops a second press from duplicating a board someone has started editing.

create or replace function pull_forward_daily_headlines(target_date date)
returns table (headlines_copied int, tasks_copied int) as $$
declare
  source_date date;
  h_count int := 0;
  t_count int := 0;
begin
  -- Guard: never touch a day that already has content.
  if exists (select 1 from daily_headlines where headline_date = target_date) then
    return query select 0, 0;
    return;
  end if;

  select dh.headline_date into source_date
    from daily_headlines dh
   where dh.headline_date < target_date
   order by dh.headline_date desc
   limit 1;

  if source_date is null then
    return query select 0, 0;
    return;
  end if;

  -- Copy the headlines, remembering which source row each new one came from so
  -- the tasks can be re-parented without relying on client name being unique.
  with inserted as (
    insert into daily_headlines (headline_date, client, text, owner, created_by)
    select target_date, dh.client, dh.text, dh.owner, dh.created_by
      from daily_headlines dh
     where dh.headline_date = source_date
     order by dh.created_at
    returning id, client
  )
  select count(*)::int into h_count from inserted;

  -- Re-parent by client within the two days. Safe because a day holds one
  -- headline per client (the board adds one entry per client).
  insert into headline_tasks (headline_id, headline_date, text, owner, sort_order, done)
  select nh.id, target_date, ht.text, ht.owner, ht.sort_order, false
    from headline_tasks ht
    join daily_headlines oh on oh.id = ht.headline_id and oh.headline_date = source_date
    join daily_headlines nh on nh.headline_date = target_date and nh.client is not distinct from oh.client
   where ht.done = false
   order by ht.sort_order, ht.id;

  get diagnostics t_count = row_count;
  return query select h_count, t_count;
end;
$$ language plpgsql;
