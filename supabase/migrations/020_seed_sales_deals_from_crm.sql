-- Seed the sales pipeline with the companies from the CRM opportunity export
-- (opportunity.csv, 37 opportunities). Company name only — stage falls to the
-- table default 'Lead' and value / owner / expected_close / notes stay null, to
-- be filled in on the board as deals get reviewed at the daily sync.
--
-- Close dates are deliberately NOT imported: only 5 of the 37 rows carry one and
-- all 5 are already in the past, so importing them would mark a third of the
-- seeded pipeline overdue on day one.
--
-- The CSV 'Name' column packs company, engagement and contact into one string
-- ("Thermal Guardian — PPC + Website + Landing Page Revival (Kwame Poku)"), so
-- the company is the text before the em dash, with nine dash-less rows mapped by
-- hand. Rows are deduped by the CSV 'Company Id', which collapses 37
-- opportunities to 35 companies — the one multi-row group covers
-- "AJ Harbinger x Russ" plus both COD opportunities, seeded once as 'COD' (the
-- client code already used in migration 006). "Acquisition Stars (AJ)" carries a
-- different Company Id and stays separate despite the shared contact.
--
-- Two of the 35 are already in sales_deals and are skipped, leaving 33 inserts:
--   * 'Vital'        — exact match on an existing row.
--   * 'Project Eros' — existing row is 'Project Eros (Daniel Hall)'.
--
-- CLEANUP NOTE: 'Ecom Luxx' (contact Conal Brady) is very likely the same deal
-- as the existing informal row 'Conal (cold email) Follow up sent'. The names
-- don't match, so it's seeded under its real company name — delete whichever row
-- is redundant on the board rather than guessing here.
--
-- sales_deals has no unique index on name, so `on conflict` isn't available;
-- each insert is guarded by a case-insensitive not-exists instead (matching the
-- clients_name_key convention). Idempotent — safe to re-run, and it won't
-- duplicate rows added by hand on the board.

insert into sales_deals (name)
select 'Brand Breakthrough'
where not exists (select 1 from sales_deals where lower(name) = lower('Brand Breakthrough'));

insert into sales_deals (name)
select 'HeartCore'
where not exists (select 1 from sales_deals where lower(name) = lower('HeartCore'));

insert into sales_deals (name)
select 'E3 Events'
where not exists (select 1 from sales_deals where lower(name) = lower('E3 Events'));

insert into sales_deals (name)
select 'Thermal Guardian'
where not exists (select 1 from sales_deals where lower(name) = lower('Thermal Guardian'));

insert into sales_deals (name)
select 'Whale Shark'
where not exists (select 1 from sales_deals where lower(name) = lower('Whale Shark'));

insert into sales_deals (name)
select 'Cake Box'
where not exists (select 1 from sales_deals where lower(name) = lower('Cake Box'));

insert into sales_deals (name)
select 'Fox RE'
where not exists (select 1 from sales_deals where lower(name) = lower('Fox RE'));

insert into sales_deals (name)
select 'Kyroc / Vujis'
where not exists (select 1 from sales_deals where lower(name) = lower('Kyroc / Vujis'));

insert into sales_deals (name)
select 'HAAB Project'
where not exists (select 1 from sales_deals where lower(name) = lower('HAAB Project'));

insert into sales_deals (name)
select 'Chapters Agency'
where not exists (select 1 from sales_deals where lower(name) = lower('Chapters Agency'));

insert into sales_deals (name)
select 'Rob Katona'
where not exists (select 1 from sales_deals where lower(name) = lower('Rob Katona'));

insert into sales_deals (name)
select 'Mayple'
where not exists (select 1 from sales_deals where lower(name) = lower('Mayple'));

insert into sales_deals (name)
select 'Timbecon'
where not exists (select 1 from sales_deals where lower(name) = lower('Timbecon'));

insert into sales_deals (name)
select 'Yodel Mobile'
where not exists (select 1 from sales_deals where lower(name) = lower('Yodel Mobile'));

insert into sales_deals (name)
select 'Ecom Luxx'
where not exists (select 1 from sales_deals where lower(name) = lower('Ecom Luxx'));

insert into sales_deals (name)
select 'COD'
where not exists (select 1 from sales_deals where lower(name) = lower('COD'));

insert into sales_deals (name)
select 'CPG Affiliate'
where not exists (select 1 from sales_deals where lower(name) = lower('CPG Affiliate'));

insert into sales_deals (name)
select 'Redstone Manufacturing'
where not exists (select 1 from sales_deals where lower(name) = lower('Redstone Manufacturing'));

insert into sales_deals (name)
select 'Smith Bros Detailing'
where not exists (select 1 from sales_deals where lower(name) = lower('Smith Bros Detailing'));

insert into sales_deals (name)
select 'Imagine Harmony'
where not exists (select 1 from sales_deals where lower(name) = lower('Imagine Harmony'));

insert into sales_deals (name)
select 'Leke Services'
where not exists (select 1 from sales_deals where lower(name) = lower('Leke Services'));

insert into sales_deals (name)
select 'Catalyst Crew'
where not exists (select 1 from sales_deals where lower(name) = lower('Catalyst Crew'));

insert into sales_deals (name)
select 'AgencyOS'
where not exists (select 1 from sales_deals where lower(name) = lower('AgencyOS'));

insert into sales_deals (name)
select 'AOC'
where not exists (select 1 from sales_deals where lower(name) = lower('AOC'));

insert into sales_deals (name)
select 'Outrider'
where not exists (select 1 from sales_deals where lower(name) = lower('Outrider'));

insert into sales_deals (name)
select 'HDL free-audit pipeline'
where not exists (select 1 from sales_deals where lower(name) = lower('HDL free-audit pipeline'));

insert into sales_deals (name)
select 'Mercury'
where not exists (select 1 from sales_deals where lower(name) = lower('Mercury'));

insert into sales_deals (name)
select 'Acquisition Stars (AJ)'
where not exists (select 1 from sales_deals where lower(name) = lower('Acquisition Stars (AJ)'));

insert into sales_deals (name)
select 'BN'
where not exists (select 1 from sales_deals where lower(name) = lower('BN'));

insert into sales_deals (name)
select 'True Form Pilates'
where not exists (select 1 from sales_deals where lower(name) = lower('True Form Pilates'));

insert into sales_deals (name)
select 'Commercial window cleaning'
where not exists (select 1 from sales_deals where lower(name) = lower('Commercial window cleaning'));

insert into sales_deals (name)
select 'ABS'
where not exists (select 1 from sales_deals where lower(name) = lower('ABS'));

insert into sales_deals (name)
select 'MergePatterns'
where not exists (select 1 from sales_deals where lower(name) = lower('MergePatterns'));

-- Sanity check after running:
--   select count(*) from sales_deals;              -- expect 38 (5 pre-existing + 33 seeded)
--   select name from sales_deals order by id;      -- no duplicate Vital / Project Eros
