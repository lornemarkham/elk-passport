-- ============================================================================
-- PRE-FLIGHT for crew-migration.sql — READ ONLY. Run in the Supabase SQL
-- editor BEFORE applying it. Every row must say OK. Writes nothing.
-- ============================================================================

-- Arena Mode (arena-migration.sql) must already be applied: the Crew reuses
-- its window helper.
select 'arena migration applied' as check_name,
       concat_ws(' / ',
         coalesce(to_regclass('public.passport_occasion_checkins')::text, 'no checkins'),
         coalesce(to_regprocedure('public.passport_arena_open(uuid,timestamptz)')::text, 'no open()'),
         coalesce(to_regprocedure('public.passport_arena_purge()')::text, 'no purge()')) as found,
       case when to_regclass('public.passport_occasion_checkins') is not null
             and to_regprocedure('public.passport_arena_open(uuid,timestamptz)') is not null
             and to_regprocedure('public.passport_arena_purge()') is not null
             then 'OK' else 'STOP' end as verdict
union all
select 'policy helpers present',
       (to_regprocedure('public.passport_occasion_role(uuid,uuid)') is not null)::text || ' / ' ||
       (to_regprocedure('public.passport_is_occasion_member(uuid,uuid)') is not null)::text,
       case when to_regprocedure('public.passport_occasion_role(uuid,uuid)') is not null
             and to_regprocedure('public.passport_is_occasion_member(uuid,uuid)') is not null then 'OK' else 'STOP' end
union all
select 'no crew tables yet',
       concat_ws(', ',
         to_regclass('public.passport_occasion_gps_hints')::text,
         to_regclass('public.passport_occasion_summons')::text,
         to_regclass('public.passport_occasion_summon_replies')::text,
         to_regclass('public.passport_occasion_snack_runs')::text,
         to_regclass('public.passport_occasion_snack_items')::text),
       case when to_regclass('public.passport_occasion_gps_hints') is null
             and to_regclass('public.passport_occasion_summons') is null
             and to_regclass('public.passport_occasion_summon_replies') is null
             and to_regclass('public.passport_occasion_snack_runs') is null
             and to_regclass('public.passport_occasion_snack_items') is null then 'OK' else 'STOP' end
union all
-- A same-named policy anywhere would silently suppress ours (guards check names).
select 'no crew policies yet',
       coalesce(string_agg(tablename || '.' || policyname, ', '), 'none'),
       case when count(*) = 0 then 'OK' else 'STOP' end
from pg_policies
where policyname like 'passport\_occasion\_gps\_hints%' or policyname like 'passport\_occasion\_summon%'
   or policyname like 'passport\_occasion\_snack%'
union all
select 'no crew functions yet',
       concat_ws(', ',
         to_regprocedure('public.passport_crew_stamp()')::text,
         to_regprocedure('public.passport_crew_purge()')::text),
       case when to_regprocedure('public.passport_crew_stamp()') is null
             and to_regprocedure('public.passport_crew_purge()') is null then 'OK' else 'STOP' end
union all
select 'postgres >= 13',
       current_setting('server_version'),
       case when current_setting('server_version_num')::int >= 130000 then 'OK' else 'STOP' end;
