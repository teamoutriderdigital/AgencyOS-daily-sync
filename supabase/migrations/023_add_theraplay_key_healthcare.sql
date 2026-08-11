-- Add Theraplay and Key Healthcare to the clients table (weekly L10 tracker +
-- /submit picker + daily headline quick-picks all draw from this table).
-- Idempotent — the case-insensitive unique index on name makes re-runs no-ops.

insert into clients (name, stage, sort_order)
values ('Theraplay', 'Onboarding', 8), ('Key Healthcare', 'Onboarding', 9)
on conflict do nothing;
