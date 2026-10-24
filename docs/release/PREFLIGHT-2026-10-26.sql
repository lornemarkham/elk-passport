-- ============================================================================
-- VANCOUVER RELEASE PRE-FLIGHT (2026-10-26) — READ ONLY.
--
-- Paste into the Supabase SQL editor of production (frllwwxesxbmmaadzfaf).
-- It reads the catalog only and changes nothing. One row per migration
-- candidate; the `state` column says which ones are already applied, so
-- nothing is pasted twice by mistake. Run it again after the migrations: every
-- row should then read APPLIED (Together may stay APPLIED-but-dark: its flag,
-- CONFERENCE_TOGETHER, is separate and stays unset).
--
-- Written on Metatron, where production cannot be read (the classifier
-- refuses production reads), so the state below is UNKNOWN until this runs.
-- ============================================================================
with t as (
  select
    -- Hockey Memories (docs/product/hockey/memories-migration.sql)
    to_regclass('public.passport_occasion_photos') is not null as memories,
    -- Hockey Mayhem (docs/product/hockey/mayhem-migration.sql)
    to_regclass('public.passport_occasion_challenges') is not null
      and to_regclass('public.passport_occasion_challenge_votes') is not null
      and to_regclass('public.passport_occasion_team_reactions') is not null as mayhem_tables,
    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'passport_issue_challenge') as issue_fns,
    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'passport_occasion_mission_ledger') as ledger_fns,
    -- Passport adventure_item_origin (supabase/migrations/20261023100000_…)
    exists (select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'passport_adventure_items'
        and column_name = 'origin') as origin_col,
    (select string_agg(permissive, ',') from pg_policies
      where policyname = 'passport_adventure_items_origin_owner') as origin_policy,
    -- Conference Together (supabase/migrations/20261023000000_…): 11 tables, 37 policies
    (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and c.relname in (
        'passport_conference_plans','passport_conference_plan_invites',
        'passport_conference_plan_occurrences','passport_conference_rsvps',
        'passport_conference_plan_options','passport_conference_plan_votes',
        'passport_conference_messages','passport_conference_message_reactions',
        'passport_conference_locations','passport_conference_photos',
        'passport_conference_photo_reactions')) as together_tables,
    (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
        and c.relname like 'passport\_conference\_%' and c.relname not in
          ('passport_conferences','passport_conference_members','passport_conference_arrivals')
        and not c.relrowsecurity) as together_rls_off,
    (select count(*) from pg_policies where schemaname = 'public' and tablename in (
        'passport_conference_plans','passport_conference_plan_invites',
        'passport_conference_plan_occurrences','passport_conference_rsvps',
        'passport_conference_plan_options','passport_conference_plan_votes',
        'passport_conference_messages','passport_conference_message_reactions',
        'passport_conference_locations','passport_conference_photos',
        'passport_conference_photo_reactions')) as together_policies
)
select 'Hockey Memories' as migration,
       case when memories then 'APPLIED' else 'NOT APPLIED' end as state,
       'if NOT APPLIED: memories-preflight.sql (every row OK), then memories-migration.sql' as next
from t
union all
select 'Hockey Mayhem',
       case when mayhem_tables and ledger_fns = 1 and issue_fns >= 1 then 'APPLIED'
            when not mayhem_tables and ledger_fns = 0 then 'NOT APPLIED'
            else 'PARTIAL — STOP, do not paste; report' end,
       'issue_challenge overloads: ' || issue_fns || ' (expect exactly 1). mayhem-preflight.sql is the authority'
from t
union all
select 'Adventure item origin',
       case when origin_col and origin_policy = 'RESTRICTIVE' then 'APPLIED'
            when not origin_col and origin_policy is null then 'NOT APPLIED'
            else 'PARTIAL — STOP; report' end,
       'safe to deploy before it (store falls back on 42703/PGRST204)'
from t
union all
select 'Conference Together',
       case when together_tables = 11 and together_policies = 37 and together_rls_off = 0 then 'APPLIED'
            when together_tables = 0 then 'NOT APPLIED'
            else 'PARTIAL — STOP; report (' || together_tables || ' tables, '
                 || together_policies || ' policies, ' || together_rls_off || ' with RLS off)' end,
       'keep CONFERENCE_TOGETHER unset either way'
from t;
