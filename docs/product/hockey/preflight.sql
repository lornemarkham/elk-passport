-- ============================================================================
-- PRE-FLIGHT for migration.sql — READ ONLY. Run in the Supabase SQL editor
-- against the production project BEFORE applying anything.
--
-- Every row returned below has a "want" column; all of them must say OK.
-- Nothing here writes, locks or changes anything.
-- ============================================================================

select 'postgres >= 15' as check_name,
       current_setting('server_version') as found,
       case when current_setting('server_version_num')::int >= 150000 then 'OK' else 'STOP' end as verdict
union all
-- Nothing of ours may already exist: the migration is guarded, but if a
-- same-named object is there it was not made by this migration and "applied
-- twice changes nothing" stops being true.
select 'no passport_occasion* tables',
       coalesce(string_agg(tablename, ', '), 'none'),
       case when count(*) = 0 then 'OK' else 'STOP' end
from pg_tables where schemaname = 'public' and tablename like 'passport\_occasion%'
union all
select 'no passport_*occasion* functions',
       coalesce(string_agg(proname, ', '), 'none'),
       case when count(*) = 0 then 'OK' else 'STOP' end
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and proname like 'passport\_%occasion%'
union all
-- The migration's "create policy unless one by that name exists" is not
-- scoped to a table; a pre-existing policy with one of our names anywhere
-- would silently suppress ours.
select 'no passport_occasion* policies',
       coalesce(string_agg(tablename || '.' || policyname, ', '), 'none'),
       case when count(*) = 0 then 'OK' else 'STOP' end
from pg_policies where policyname like 'passport\_occasion%'
union all
-- The migration references auth.users and auth.uid() and nothing in Atlas's
-- schema. Passport's own baseline must be in place (it is the pattern, and
-- the shared project is where Hockey Night will live).
select 'auth.users and auth.uid() present',
       (to_regclass('auth.users') is not null)::text || ' / ' || (to_regprocedure('auth.uid()') is not null)::text,
       case when to_regclass('auth.users') is not null and to_regprocedure('auth.uid()') is not null then 'OK' else 'STOP' end
union all
select 'Passport baseline present (passport_board_members, passport_profiles)',
       (to_regclass('public.passport_board_members') is not null)::text || ' / ' || (to_regclass('public.passport_profiles') is not null)::text,
       case when to_regclass('public.passport_board_members') is not null and to_regclass('public.passport_profiles') is not null then 'OK' else 'STOP' end
union all
-- The security model assumes Supabase's standard roles and default grants
-- (anon + authenticated hold ALL on new public tables), which is what the RLS
-- attack run used. If this says otherwise, stop and tell the lane.
select 'roles anon / authenticated exist',
       (select string_agg(rolname, ', ') from pg_roles where rolname in ('anon','authenticated')),
       case when (select count(*) from pg_roles where rolname in ('anon','authenticated')) = 2 then 'OK' else 'STOP' end
union all
select 'gen_random_uuid(), sha256() available',
       (to_regprocedure('gen_random_uuid()') is not null)::text || ' / ' || (to_regprocedure('sha256(bytea)') is not null)::text,
       case when to_regprocedure('gen_random_uuid()') is not null and to_regprocedure('sha256(bytea)') is not null then 'OK' else 'STOP' end;

-- For the record (informational — no verdict): the signed-in role's default
-- table privileges in public. Expect ALL for anon/authenticated/service_role.
select defaclrole::regrole as owner, defaclacl::text as default_privileges
from pg_default_acl d join pg_namespace n on n.oid = d.defaclnamespace
where n.nspname = 'public' and defaclobjtype = 'r';
