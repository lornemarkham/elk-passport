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

-- ============================================================================
-- G. "Packing says it isn't switched on, but the table is there."
--    (SHARED-ADVENTURE.md, 2026-11-02). Read-only. The page now names the
--    reason on the owner's packing panel, with the database's code; these
--    rows say the same thing from the inside.
--    Expect: exists true, rls true, authenticated_select true,
--    authenticated_insert true, authenticated_delete true,
--    authenticated_update_checked true, policies 4, members_fn true.
SELECT to_regclass('public.passport_adventure_packing') IS NOT NULL AS exists,
       (SELECT relrowsecurity FROM pg_class
         WHERE oid = to_regclass('public.passport_adventure_packing')) AS rls,
       has_table_privilege('authenticated', 'public.passport_adventure_packing', 'SELECT') AS authenticated_select,
       has_table_privilege('authenticated', 'public.passport_adventure_packing', 'INSERT') AS authenticated_insert,
       has_table_privilege('authenticated', 'public.passport_adventure_packing', 'DELETE') AS authenticated_delete,
       has_column_privilege('authenticated', 'public.passport_adventure_packing', 'checked_at', 'UPDATE') AS authenticated_update_checked,
       (SELECT count(*) FROM pg_policies WHERE schemaname = 'public'
         AND tablename = 'passport_adventure_packing') AS policies,
       has_function_privilege('authenticated', 'public.passport_is_adventure_member(text)', 'EXECUTE') AS members_fn;

-- H. The columns the app reads. Expect all eight:
--    id, adventure_id, label, position, added_by, checked_by, checked_at,
--    created_at. A missing one is the "doesn't match the migration" case.
SELECT column_name, data_type
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'passport_adventure_packing'
 ORDER BY ordinal_position;

-- The remedies (these WRITE; run only the one the panel or G/H points at):
--
--   PGRST205 on the panel, G all true  → the API's schema cache is stale:
--       NOTIFY pgrst, 'reload schema';
--   42501 on the panel, G has a false  → the grants didn't land; re-run
--       supabase/migrations/20261102100000_passport_adventure_packing.sql
--       (guarded, safe twice), then the NOTIFY above.
--   42703 / mismatch, H is short       → the table isn't this migration's.
--       Stop and ask: don't drop a table with people's lists in it.
