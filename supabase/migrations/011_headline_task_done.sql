-- Per-task completion on client-headline tasks: a `done` flag so each task can
-- be marked completed next to its owner. Defaults to false. Idempotent.

alter table headline_tasks add column if not exists done boolean not null default false;
