-- ============================================================================
-- PREFLIGHT — Date Night's packing list and memories (read-only)
-- Mission 495, 2026-11-02. Run in the Supabase SQL editor of the Passport
-- project BEFORE and AFTER applying, in this order:
--   1. supabase/migrations/20261101000000_passport_adventure_together.sql
--   2. supabase/migrations/20261102100000_passport_adventure_packing.sql
-- Nothing here writes. Each block is one statement; run them one at a time.
-- Rehearsed on a disposable local stack with data in it (MAGICAL.md, §5).
-- ============================================================================

-- A. What is applied, and are the prerequisites there?
--    Before: prerequisites all true; the two migrations false (or true if
--    somebody already ran them — then skip that file).
--    After: everything true.
SELECT 'prerequisite: adventure core (20261021000000)' AS what,
       to_regclass('public.passport_adventures') IS NOT NULL
   AND to_regclass('public.passport_adventure_members') IS NOT NULL
   AND to_regprocedure('public.passport_is_adventure_member(text)') IS NOT NULL
   AND to_regprocedure('public.passport_is_adventure_owner(text)') IS NOT NULL AS ok
UNION ALL
SELECT 'memories (20261101000000_passport_adventure_together)',
       to_regclass('public.passport_adventure_moments') IS NOT NULL
   AND to_regclass('public.passport_adventure_notices') IS NOT NULL
   AND to_regclass('public.passport_adventure_notice_acks') IS NOT NULL
UNION ALL
SELECT 'packing (20261102100000_passport_adventure_packing)',
       to_regclass('public.passport_adventure_packing') IS NOT NULL;

-- B. Existing rows. Write these down before; they must be identical after.
SELECT (SELECT count(*) FROM public.passport_adventures) AS adventures,
       (SELECT count(*) FROM public.passport_adventure_members) AS members,
       (SELECT count(*) FROM public.passport_adventure_items) AS items,
       (SELECT count(*) FROM public.passport_adventures
         WHERE kind = 'date-night-plan') AS date_nights;

-- C. Any Passport table with row level security off. Expect no rows.
SELECT c.relname AS rls_off
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relkind = 'r'
   AND c.relname LIKE 'passport\_%' AND NOT c.relrowsecurity;

-- D. Anything granted to anon on a Passport adventure table. Expect no rows.
SELECT table_name, privilege_type
  FROM information_schema.role_table_grants
 WHERE grantee = 'anon' AND table_schema = 'public'
   AND table_name LIKE 'passport\_adventure%';

-- E. After only: the policies. Expect packing 4, moments 3, notices 4,
--    notice_acks 3 (or more, never fewer).
SELECT tablename, count(*) AS policies
  FROM pg_policies
 WHERE schemaname = 'public'
   AND tablename IN ('passport_adventure_packing', 'passport_adventure_moments',
                     'passport_adventure_notices', 'passport_adventure_notice_acks')
 GROUP BY tablename ORDER BY tablename;

-- F. After only: what authenticated may do on the new tables. Packing:
--    SELECT, INSERT, DELETE on the table and UPDATE on checked_by/checked_at
--    only (column grants show in information_schema.column_privileges).
SELECT table_name, privilege_type
  FROM information_schema.role_table_grants
 WHERE grantee = 'authenticated' AND table_schema = 'public'
   AND table_name IN ('passport_adventure_packing', 'passport_adventure_moments')
 ORDER BY 1, 2;
