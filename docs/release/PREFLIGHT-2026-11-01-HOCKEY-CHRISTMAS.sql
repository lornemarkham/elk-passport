-- ============================================================================
-- PREFLIGHT 2026-11-01 — Hockey Night finish + Go Have a Christmas
-- READ-ONLY. Paste into the Supabase SQL editor of the Passport project
-- (frllwwxesxbmmaadzfaf). It changes nothing; run it BEFORE the migrations,
-- save the result, run it again AFTER, and compare.
--
-- Release record: docs/release/RELEASE-2026-11-01-HOCKEY-CHRISTMAS.md
--
-- Measured from Metatron on 2026-11-01 with the public anon key (existence
-- only): Crew, Adventure origin, Chirp, Alive are in production; the
-- announce columns and the three together tables are not. The Hockey Plan
-- data rows cannot be seen with the anon key — block A answers that.
-- ============================================================================

-- A. What still needs applying. Expect before: Plan = APPLIED or NOT APPLIED,
--    Announce = NOT APPLIED, Together = NOT APPLIED. Expect after: all three
--    APPLIED.
select 'A1 Hockey Plan (plan-migration.sql, data rows)' as check,
       case when to_regclass('public.passport_occasion_prompts') is null then 'STOP: no prompts table'
            when (select count(*) from public.passport_occasions o
                   where o.template = 'sycle-hockey-night'
                     and not exists (select 1 from public.passport_occasion_prompts p
                                      where p.occasion_id = o.id and p.prompt_id = 'pregame-plans')) = 0
            then 'APPLIED' else 'NOT APPLIED' end as verdict
union all
select 'A2 Hockey announcements (announce-migration.sql)',
       case when (select count(*) from information_schema.columns
                   where table_schema = 'public' and table_name = 'passport_occasion_moments'
                     and column_name in ('reply_to', 'tag', 'href')) = 3
                 and exists (select 1 from pg_trigger where tgname = 'passport_occasion_moments_reply')
            then 'APPLIED' else 'NOT APPLIED' end
union all
select 'A3 Adventure together (20261101000000_passport_adventure_together.sql)',
       case when to_regclass('public.passport_adventure_notices') is not null
                 and to_regclass('public.passport_adventure_notice_acks') is not null
                 and to_regclass('public.passport_adventure_moments') is not null
            then 'APPLIED' else 'NOT APPLIED' end
union all
-- Prerequisites: each must say ok before anything is applied.
select 'P1 chirp in (announce needs it)',
       case when exists (select 1 from information_schema.columns
                          where table_schema = 'public' and table_name = 'passport_occasion_moments'
                            and column_name = 'bot_key') then 'ok' else 'STOP' end
union all
select 'P2 adventures core in (together needs it)',
       case when to_regprocedure('public.passport_is_adventure_member(text)') is not null
                 and to_regprocedure('public.passport_is_adventure_owner(text)') is not null
            then 'ok' else 'STOP' end;

-- B. Existing data — the counts must be identical before and after (the
--    migrations add columns and tables; they move and delete nothing).
select 'B adventures' as what, count(*) as n from public.passport_adventures
union all select 'B adventure members', count(*) from public.passport_adventure_members
union all select 'B adventure items', count(*) from public.passport_adventure_items
union all select 'B christmas adventures', count(*) from public.passport_adventures where kind = 'christmas'
union all select 'B hockey nights', count(*) from public.passport_occasions where template = 'sycle-hockey-night'
union all select 'B occasion members', count(*) from public.passport_occasion_members
union all select 'B occasion moments (chat)', count(*) from public.passport_occasion_moments
union all select 'B occasion photos', count(*) from public.passport_occasion_photos;

-- C. Row-level security. Expect ZERO rows: every Passport table has RLS on.
select 'C RLS OFF' as problem, c.relname as table_name
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r'
   and (c.relname like 'passport_adventure%' or c.relname like 'passport_occasion%')
   and not c.relrowsecurity;

-- D. What anon can touch on these tables. Expect ZERO rows (the app reads as
--    the signed-in person; production has no default grants).
select 'D anon grant' as problem, table_name, privilege_type
  from information_schema.role_table_grants
 where grantee = 'anon' and table_schema = 'public'
   and (table_name like 'passport_adventure%' or table_name like 'passport_occasion%');

-- E. After only: the new tables' policies (expect 4 notices, 3 acks, 3 moments)
--    and the re-stated Hockey insert policy (expect 1).
select 'E policies' as what, tablename, count(*) as n
  from pg_policies
 where schemaname = 'public'
   and (tablename in ('passport_adventure_notices', 'passport_adventure_notice_acks', 'passport_adventure_moments')
        or (tablename = 'passport_occasion_moments' and policyname = 'passport_occasion_moments_say'))
 group by tablename order by tablename;
