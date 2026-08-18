-- Add Lianna to the team_member enum so they can be an IDS owner, to-do assignee,
-- and daily check-in member (owner/assignee/member columns are this enum type).
-- Idempotent. Note: ALTER TYPE ... ADD VALUE must run on its own (not inside a
-- transaction that then uses the value) — running it alone in the SQL editor is fine.

alter type team_member add value if not exists 'Lianna';
