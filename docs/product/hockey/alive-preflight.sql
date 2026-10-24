-- ============================================================================
-- PRE-FLIGHT for alive-migration.sql — READ ONLY. Run in the Supabase SQL
-- editor BEFORE applying it. Every row must say OK.
-- ============================================================================
select 'occasion members present' as check_name,
       (to_regclass('public.passport_occasion_members') is not null)::text as found,
       case when to_regclass('public.passport_occasion_members') is not null then 'OK' else 'STOP' end as verdict
union all
select 'chirp-migration.sql applied (nhl_team, bot_key)',
       count(*)::text,
       case when count(*) = 2 then 'OK' else 'STOP (apply chirp-migration.sql first)' end
from information_schema.columns
where table_schema = 'public'
  and ((table_name = 'passport_occasion_members' and column_name = 'nhl_team')
    or (table_name = 'passport_occasion_moments' and column_name = 'bot_key'))
union all
select 'self-keyed bot rule is chirp-migration.sql''s',
       coalesce(max(pg_get_constraintdef(oid)), 'none'),
       case when count(*) = 1 then 'OK' else 'STOP' end
from pg_constraint where conname = 'passport_occasion_moments_bot_self_check'
union all
select 'member self-update policy present',
       coalesce(string_agg(policyname, ', '), 'none'),
       case when count(*) >= 1 then 'OK' else 'STOP' end
from pg_policies
where tablename = 'passport_occasion_members' and cmd = 'UPDATE'
union all
select 'no watching column yet',
       coalesce(string_agg(column_name, ', '), 'none'),
       case when count(*) = 0 then 'OK' else 'REVIEW (already applied?)' end
from information_schema.columns
where table_schema = 'public' and table_name = 'passport_occasion_members'
  and column_name = 'watching';
