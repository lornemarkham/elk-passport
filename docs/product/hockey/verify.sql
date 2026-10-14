-- ============================================================================
-- POST-APPLY CHECK for migration.sql — READ ONLY. Every row must say OK.
-- ============================================================================
select 'tables = 10' as check_name,
       count(*)::text as found,
       case when count(*) = 10 then 'OK' else 'STOP' end as verdict
from pg_tables where schemaname = 'public' and tablename like 'passport\_occasion%'
union all
select 'RLS enabled on all 10', count(*)::text,
       case when count(*) = 10 then 'OK' else 'STOP' end
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname like 'passport\_occasion%' and c.relkind = 'r' and c.relrowsecurity
union all
select 'policies = 25', count(*)::text,
       case when count(*) = 25 then 'OK' else 'STOP' end
from pg_policies where policyname like 'passport\_occasion%'
union all
select 'functions = 8', count(*)::text,
       case when count(*) = 8 then 'OK' else 'STOP' end
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and proname like 'passport\_%occasion%'
union all
-- Signed-out visitors: no table access at all.
select 'anon has no privilege on any occasion table', coalesce(string_agg(t, ', '), 'none'),
       case when count(*) = 0 then 'OK' else 'STOP' end
from (select tablename t from pg_tables
      where schemaname = 'public' and tablename like 'passport\_occasion%'
        and (has_table_privilege('anon', 'public.' || tablename, 'select')
          or has_table_privilege('anon', 'public.' || tablename, 'insert'))) x
union all
-- anon may execute exactly one function: "is this link any good?"
select 'anon can execute only the invite-validity function', coalesce(string_agg(proname, ', '), 'none'),
       case when coalesce(string_agg(proname, ', '), '') = 'passport_describe_occasion_invite' then 'OK' else 'STOP' end
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and proname like 'passport\_%occasion%'
  and has_function_privilege('anon', p.oid, 'execute')
union all
-- The four columns/tables a member must NOT be able to rewrite.
select 'authenticated cannot UPDATE members.role / occasions.host_id',
       (has_column_privilege('authenticated', 'public.passport_occasion_members', 'role', 'update')
        or has_column_privilege('authenticated', 'public.passport_occasions', 'host_id', 'update'))::text,
       case when not (has_column_privilege('authenticated', 'public.passport_occasion_members', 'role', 'update')
        or has_column_privilege('authenticated', 'public.passport_occasions', 'host_id', 'update')) then 'OK' else 'STOP' end
union all
select 'authenticated cannot UPDATE invites.uses',
       has_column_privilege('authenticated', 'public.passport_occasion_invites', 'uses', 'update')::text,
       case when not has_column_privilege('authenticated', 'public.passport_occasion_invites', 'uses', 'update') then 'OK' else 'STOP' end
union all
-- Nothing of Passport's baseline was touched.
select 'baseline still has 8 passport_* tables', count(*)::text,
       case when count(*) = 8 then 'OK' else 'STOP' end
from pg_tables where schemaname = 'public' and tablename like 'passport\_%' and tablename not like 'passport\_occasion%';
