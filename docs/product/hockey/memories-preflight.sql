-- ============================================================================
-- PRE-FLIGHT for memories-migration.sql — READ ONLY. Run in the Supabase SQL
-- editor BEFORE applying it. Every row must say OK.
-- ============================================================================
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
select 'no passport_occasion_photos table',
       coalesce(to_regclass('public.passport_occasion_photos')::text, 'none'),
       case when to_regclass('public.passport_occasion_photos') is null then 'OK' else 'STOP' end
union all
select 'no passport_occasion_photos_* policies',
       coalesce(string_agg(tablename || '.' || policyname, ', '), 'none'),
       case when count(*) = 0 then 'OK' else 'STOP' end
from pg_policies where policyname like 'passport\_occasion\_photos%';
