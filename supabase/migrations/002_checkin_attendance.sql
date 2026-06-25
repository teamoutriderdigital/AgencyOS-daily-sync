-- Check-in → attendance. Replaces the free-text "mood" check-in with a quick
-- Present / Remote / Out status per member. Safe to run on an existing database
-- (idempotent). The `mood` column is kept (now optional/unused) so no data is
-- dropped.

do $$ begin
  create type attendance_status as enum ('Present', 'Remote', 'Out');
exception when duplicate_object then null;
end $$;

alter table daily_checkins add column if not exists status attendance_status;
