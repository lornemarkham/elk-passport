-- ============================================================================
-- PRE-FLIGHT for chirp-migration.sql — READ ONLY. Run in the Supabase SQL
-- editor BEFORE applying it. Every row must say OK.
-- ============================================================================
select 'occasion members + moments present' as check_name,
       (to_regclass('public.passport_occasion_members') is not null)::text || ' / ' ||
       (to_regclass('public.passport_occasion_moments') is not null)::text as found,
       case when to_regclass('public.passport_occasion_members') is not null
             and to_regclass('public.passport_occasion_moments') is not null then 'OK' else 'STOP' end as verdict
union all
select 'policy helper present',
       (to_regprocedure('public.passport_is_occasion_member(uuid,uuid)') is not null)::text,
       case when to_regprocedure('public.passport_is_occasion_member(uuid,uuid)') is not null then 'OK' else 'STOP' end
union all
select 'moments kind check is the original one',
       coalesce(max(pg_get_constraintdef(oid)), 'none'),
       case when count(*) = 1 then 'OK' else 'STOP' end
from pg_constraint where conname = 'passport_occasion_moments_kind_check'
union all
select 'moments insert policy present',
       coalesce(string_agg(policyname, ', '), 'none'),
       case when count(*) = 1 then 'OK' else 'STOP' end
from pg_policies where policyname = 'passport_occasion_moments_say'
union all
select 'no chirp columns yet',
       coalesce(string_agg(table_name || '.' || column_name, ', '), 'none'),
       case when count(*) = 0 then 'OK' else 'REVIEW (already applied?)' end
from information_schema.columns
where table_schema = 'public'
  and ((table_name = 'passport_occasion_members' and column_name = 'nhl_team')
    or (table_name = 'passport_occasion_moments' and column_name in ('bot_key', 'bot_line', 'bot_sig')));
