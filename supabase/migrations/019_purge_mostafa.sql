-- Remove every remaining trace of Mostafa from the board data.
--
-- 018 swapped the active roster and reassigned his OPEN work, but deliberately
-- left history alone. That decision was reversed: his name must not appear
-- anywhere on the board, so this rewrites the historical rows too.
--
-- What this costs, stated plainly so it isn't a surprise later:
--   * Rasika is credited with Done rock #23 (the 20–30 workflows Mostafa
--     finished) and with the two done headline tasks from 16 Jul.
--   * Rasika is recorded as present at the 6, 14 and 17 Jul stand-ups and as
--     the author of the 13, 20 and 27 Jul meeting ratings — all before he
--     joined. The week-over-week rating history is no longer a true record of
--     who scored what.
-- Run it in one go; every statement is idempotent and safe to re-run.

begin;

-- ── 1. Owner / assignee / member columns ────────────────────────────────────

update action_items      set assignee   = 'Rasika' where assignee   = 'Mostafa';
update ids_items         set owner      = 'Rasika' where owner      = 'Mostafa';
update daily_headlines   set owner      = 'Rasika' where owner      = 'Mostafa';
update daily_headlines   set created_by = 'Rasika' where created_by = 'Mostafa';
update headline_tasks    set owner      = 'Rasika' where owner      = 'Mostafa';
update daily_review_items set created_by = 'Rasika' where created_by = 'Mostafa';
update sales_deals       set owner      = 'Rasika' where owner      = 'Mostafa';
update ops_tasks         set owner      = 'Rasika' where owner      = 'Mostafa';
update innovations       set found_by   = 'Rasika' where found_by   = 'Mostafa';
update clients           set owner      = 'Rasika' where owner      = 'Mostafa';

-- rocks.owner is free text and currently reads 'Mostafa (former)'.
update rocks set owner = 'Rasika' where owner ilike '%mostafa%';

-- daily_checkins and meeting_ratings are unique per (date, member). Only move
-- the row if Rasika has no row for that date already, otherwise drop the
-- duplicate rather than blowing up on the constraint.
delete from daily_checkins d
 where d.member = 'Mostafa'
   and exists (select 1 from daily_checkins x
                where x.checkin_date = d.checkin_date and x.member = 'Rasika');
update daily_checkins set member = 'Rasika' where member = 'Mostafa';

delete from meeting_ratings m
 where m.member = 'Mostafa'
   and exists (select 1 from meeting_ratings x
                where x.rating_date = m.rating_date and x.member = 'Rasika');
update meeting_ratings set member = 'Rasika' where member = 'Mostafa';

-- ── 2. His name inside free text ────────────────────────────────────────────
-- This is the part updating owner columns never reached, and the reason he kept
-- reappearing. Covers the 'Mustafa' misspelling that also occurs in the data.

update headline_tasks    set text     = regexp_replace(text,     '(Mostafa|Mustafa)', 'Rasika', 'gi') where text     ~* '(mostafa|mustafa)';
update daily_headlines   set text     = regexp_replace(text,     '(Mostafa|Mustafa)', 'Rasika', 'gi') where text     ~* '(mostafa|mustafa)';
update action_items      set item     = regexp_replace(item,     '(Mostafa|Mustafa)', 'Rasika', 'gi') where item     ~* '(mostafa|mustafa)';
update ids_items         set issue    = regexp_replace(issue,    '(Mostafa|Mustafa)', 'Rasika', 'gi') where issue    ~* '(mostafa|mustafa)';
update ids_items         set identify = regexp_replace(identify, '(Mostafa|Mustafa)', 'Rasika', 'gi') where identify ~* '(mostafa|mustafa)';
update ids_items         set discuss  = regexp_replace(discuss,  '(Mostafa|Mustafa)', 'Rasika', 'gi') where discuss  ~* '(mostafa|mustafa)';
update ids_items         set solve    = regexp_replace(solve,    '(Mostafa|Mustafa)', 'Rasika', 'gi') where solve    ~* '(mostafa|mustafa)';
update rocks             set title    = regexp_replace(title,    '(Mostafa|Mustafa)', 'Rasika', 'gi') where title    ~* '(mostafa|mustafa)';
update rocks             set smart    = regexp_replace(smart,    '(Mostafa|Mustafa)', 'Rasika', 'gi') where smart    ~* '(mostafa|mustafa)';
update ops_tasks         set title    = regexp_replace(title,    '(Mostafa|Mustafa)', 'Rasika', 'gi') where title    ~* '(mostafa|mustafa)';
update sales_deals       set name     = regexp_replace(name,     '(Mostafa|Mustafa)', 'Rasika', 'gi') where name     ~* '(mostafa|mustafa)';
update sales_deals       set notes    = regexp_replace(notes,    '(Mostafa|Mustafa)', 'Rasika', 'gi') where notes    ~* '(mostafa|mustafa)';
update daily_review_items set text    = regexp_replace(text,     '(Mostafa|Mustafa)', 'Rasika', 'gi') where text     ~* '(mostafa|mustafa)';
update innovations       set title    = regexp_replace(title,    '(Mostafa|Mustafa)', 'Rasika', 'gi') where title    ~* '(mostafa|mustafa)';
update innovations       set note     = regexp_replace(note,     '(Mostafa|Mustafa)', 'Rasika', 'gi') where note     ~* '(mostafa|mustafa)';
update clients           set notes    = regexp_replace(notes,    '(Mostafa|Mustafa)', 'Rasika', 'gi') where notes    ~* '(mostafa|mustafa)';

commit;

-- The 'Mostafa' value stays in the team_member enum — Postgres cannot drop an
-- enum value in place. After this runs nothing references it, and he is out of
-- both OWNERS and the TeamMember type, so it is inert.

-- Verify (should return zero rows):
--   select 'action_items' t, count(*) from action_items where assignee = 'Mostafa' or item ~* 'mostafa|mustafa'
--   union all select 'ids_items', count(*) from ids_items where owner = 'Mostafa' or issue ~* 'mostafa|mustafa'
--   union all select 'headline_tasks', count(*) from headline_tasks where owner = 'Mostafa' or text ~* 'mostafa|mustafa'
--   union all select 'rocks', count(*) from rocks where owner ilike '%mostafa%' or title ~* 'mostafa|mustafa';
