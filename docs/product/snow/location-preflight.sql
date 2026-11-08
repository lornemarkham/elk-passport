-- PREFLIGHT / CHECK for location-migration.sql. Read-only. Before: the first
-- row true, the rest false. After: every row true.
SELECT 'requires: Snow migration applied (passport_is_snow_member)' AS check,
       to_regprocedure('public.passport_is_snow_member(text)') IS NOT NULL AS ok
UNION ALL SELECT 'location: table present',
       to_regclass('public.passport_snow_locations') IS NOT NULL
UNION ALL SELECT 'location: RLS on',
       COALESCE((SELECT rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename='passport_snow_locations'), false)
UNION ALL SELECT 'location: anon holds nothing',
       to_regclass('public.passport_snow_locations') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM information_schema.role_table_grants
                       WHERE table_schema='public' AND table_name='passport_snow_locations' AND grantee='anon')
UNION ALL SELECT 'location: no UPDATE on expires_at, started_at, user_id or adventure_id',
       to_regclass('public.passport_snow_locations') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM information_schema.column_privileges
                       WHERE table_schema='public' AND table_name='passport_snow_locations'
                         AND grantee='authenticated' AND privilege_type='UPDATE'
                         AND column_name IN ('expires_at','started_at','user_id','adventure_id'))
UNION ALL SELECT 'location: four policies (read, share, move, stop)',
       (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='passport_snow_locations') = 4
UNION ALL SELECT 'location: guard trigger and member-gone trigger',
       EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='passport_snow_locations_guard')
       AND EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='passport_snow_locations_gone')
UNION ALL SELECT 'location: anon cannot execute any location function',
       NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                   WHERE n.nspname='public' AND p.proname LIKE 'passport\_snow\_%'
                     AND (p.proname LIKE '%locations%' OR p.proname='passport_snow_is_sharing')
                     AND has_function_privilege('anon', p.oid, 'EXECUTE'));
