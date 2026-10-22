-- ============================================================================
-- PRE-FLIGHT for arena-migration.sql — READ ONLY. Run in the Supabase SQL
-- editor against the production project BEFORE applying it. Every row must
-- say OK (pg_cron is INFO either way). Nothing here writes, locks or changes
-- anything.
-- ============================================================================

-- Hockey Night itself (migration.sql) must already be there.
select 'passport_occasions + members present' as check_name,
       (to_regclass('public.passport_occasions') is not null)::text || ' / ' ||
       (to_regclass('public.passport_occasion_members') is not null)::text as found,
       case when to_regclass('public.passport_occasions') is not null
             and to_regclass('public.passport_occasion_members') is not null then 'OK' else 'STOP' end as verdict
union all
select 'policy helpers present',
       (to_regprocedure('public.passport_occasion_role(uuid,uuid)') is not null)::text || ' / ' ||
       (to_regprocedure('public.passport_is_occasion_member(uuid,uuid)') is not null)::text,
       case when to_regprocedure('public.passport_occasion_role(uuid,uuid)') is not null
             and to_regprocedure('public.passport_is_occasion_member(uuid,uuid)') is not null then 'OK' else 'STOP' end
union all
-- The window helper reads starts_at under the caller's RLS: members must be
-- able to read their own night (passport_occasions_member_read).
select 'members can read their night (policy)',
       coalesce(string_agg(policyname, ', '), 'none'),
       case when count(*) > 0 then 'OK' else 'STOP' end
from pg_policies where tablename = 'passport_occasions' and cmd in ('SELECT', 'ALL')
union all
-- Nothing of ours may exist yet; a same-named policy anywhere would
-- silently suppress ours (the guards check names, not tables).
select 'no arena tables yet',
       concat_ws(', ',
         to_regclass('public.passport_occasion_checkins')::text,
         to_regclass('public.passport_occasion_pings')::text,
         to_regclass('public.passport_occasion_quests')::text,
         to_regclass('public.passport_occasion_quest_crew')::text),
       case when to_regclass('public.passport_occasion_checkins') is null
             and to_regclass('public.passport_occasion_pings') is null
             and to_regclass('public.passport_occasion_quests') is null
             and to_regclass('public.passport_occasion_quest_crew') is null then 'OK' else 'STOP' end
union all
select 'no arena policies yet',
       coalesce(string_agg(tablename || '.' || policyname, ', '), 'none'),
       case when count(*) = 0 then 'OK' else 'STOP' end
from pg_policies
where policyname like 'passport\_occasion\_checkins%' or policyname like 'passport\_occasion\_pings%'
   or policyname like 'passport\_occasion\_quests%' or policyname like 'passport\_occasion\_quest\_crew%'
union all
select 'no arena functions yet',
       concat_ws(', ',
         to_regprocedure('public.passport_arena_open(uuid,timestamptz)')::text,
         to_regprocedure('public.passport_arena_purge()')::text,
         to_regprocedure('public.passport_arena_stamp()')::text),
       case when to_regprocedure('public.passport_arena_open(uuid,timestamptz)') is null
             and to_regprocedure('public.passport_arena_purge()') is null
             and to_regprocedure('public.passport_arena_stamp()') is null then 'OK' else 'STOP' end
union all
-- gen_random_uuid() is built in from PostgreSQL 13.
select 'postgres >= 13',
       current_setting('server_version'),
       case when current_setting('server_version_num')::int >= 130000 then 'OK' else 'STOP' end
union all
-- Optional: with pg_cron, schedule the purge hourly (see ARENA-MODE.md).
select 'pg_cron available (optional)',
       coalesce((select installed_version from pg_available_extensions where name = 'pg_cron'), 'not installed') ||
       ' / available: ' || exists (select 1 from pg_available_extensions where name = 'pg_cron')::text,
       'INFO';
