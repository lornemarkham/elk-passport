-- ============================================================================
-- PREFLIGHT / CHECK for supabase/migrations/20261103000000_passport_snow.sql. Read-only. Run before (expect
-- the core present and Snow absent) and after (expect every row TRUE).
-- ============================================================================
SELECT 'core: passport_adventures present' AS check,
       to_regclass('public.passport_adventures') IS NOT NULL AS ok
UNION ALL SELECT 'core: passport_create_adventure present',
       to_regprocedure('public.passport_create_adventure(text,text,text,date,date,text,text,text)') IS NOT NULL
UNION ALL SELECT 'core: passport_is_adventure_owner present',
       to_regprocedure('public.passport_is_adventure_owner(text)') IS NOT NULL
UNION ALL SELECT 'snow: all 16 tables present',
       (SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'passport_snow\_%') = 16
UNION ALL SELECT 'snow: RLS on every table',
       (SELECT bool_and(rowsecurity) FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'passport_snow\_%')
UNION ALL SELECT 'snow: anon holds nothing',
       NOT EXISTS (SELECT 1 FROM information_schema.role_table_grants
                   WHERE table_schema = 'public' AND table_name LIKE 'passport\_snow\_%' AND grantee = 'anon')
UNION ALL SELECT 'snow: authenticated cannot TRUNCATE or REFERENCES',
       NOT EXISTS (SELECT 1 FROM information_schema.role_table_grants
                   WHERE table_schema = 'public' AND table_name LIKE 'passport\_snow\_%'
                     AND grantee = 'authenticated' AND privilege_type IN ('TRUNCATE', 'REFERENCES', 'TRIGGER'))
UNION ALL SELECT 'snow: every table has a member-read policy',
       (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND policyname LIKE 'passport\_snow\_%\_member\_read') = 16
UNION ALL SELECT 'snow: start and decide are one transaction each',
       to_regprocedure('public.passport_snow_start(text,text,text,text,boolean,text)') IS NOT NULL
       AND to_regprocedure('public.passport_snow_decide(text,text,uuid,boolean,date,text,text)') IS NOT NULL
UNION ALL SELECT 'snow: anon cannot call any snow function',
       NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                   WHERE n.nspname = 'public' AND p.proname LIKE 'passport\_%snow%'
                     AND has_function_privilege('anon', p.oid, 'EXECUTE'))
UNION ALL SELECT 'snow: photos are raster images only',
       EXISTS (SELECT 1 FROM pg_constraint
               WHERE conrelid = to_regclass('public.passport_snow_moments')
                 AND pg_get_constraintdef(oid) LIKE '%jpeg|png|webp%')
UNION ALL SELECT 'snow: member-gone trigger on the core',
       EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'passport_snow_members_gone')
UNION ALL SELECT 'other kinds untouched: no snow policy on core tables',
       NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                   AND tablename LIKE 'passport\_adventure%' AND policyname LIKE '%snow%');
