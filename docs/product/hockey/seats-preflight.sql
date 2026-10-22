-- ============================================================================
-- PRE-FLIGHT for seats-migration.sql — READ ONLY. Run in the Supabase SQL
-- editor against the production project BEFORE applying it. Every row must
-- say OK. Nothing here writes, locks or changes anything.
-- ============================================================================

-- UNIQUE NULLS NOT DISTINCT (one group block per night) needs PostgreSQL 15.
select 'postgres >= 15' as check_name,
       current_setting('server_version') as found,
       case when current_setting('server_version_num')::int >= 150000 then 'OK' else 'STOP' end as verdict
union all
-- Hockey Night itself (migration.sql) must already be there.
select 'passport_occasions + members present',
       (to_regclass('public.passport_occasions') is not null)::text || ' / ' ||
       (to_regclass('public.passport_occasion_members') is not null)::text,
       case when to_regclass('public.passport_occasions') is not null
             and to_regclass('public.passport_occasion_members') is not null then 'OK' else 'STOP' end
union all
select 'policy helpers present',
       (to_regprocedure('public.passport_occasion_role(uuid,uuid)') is not null)::text || ' / ' ||
       (to_regprocedure('public.passport_is_occasion_member(uuid,uuid)') is not null)::text,
       case when to_regprocedure('public.passport_occasion_role(uuid,uuid)') is not null
             and to_regprocedure('public.passport_is_occasion_member(uuid,uuid)') is not null then 'OK' else 'STOP' end
union all
-- Nothing of ours may exist yet; a same-named policy anywhere would
-- silently suppress ours (the guards check names, not tables).
select 'no passport_occasion_seats table',
       coalesce(to_regclass('public.passport_occasion_seats')::text, 'none'),
       case when to_regclass('public.passport_occasion_seats') is null then 'OK' else 'STOP' end
union all
select 'no passport_occasion_seats_* policies',
       coalesce(string_agg(tablename || '.' || policyname, ', '), 'none'),
       case when count(*) = 0 then 'OK' else 'STOP' end
from pg_policies where policyname like 'passport\_occasion\_seats%'
union all
-- The meeting point is written into details by the host; the existing
-- column grant must allow it.
select 'host may update passport_occasions.details',
       has_column_privilege('authenticated', 'public.passport_occasions', 'details', 'UPDATE')::text,
       case when has_column_privilege('authenticated', 'public.passport_occasions', 'details', 'UPDATE') then 'OK' else 'STOP' end;
