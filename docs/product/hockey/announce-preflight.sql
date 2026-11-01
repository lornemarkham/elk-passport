-- Hockey Night — announcements and replies: read-only preflight (2026-11-01).
-- Run before announce-migration.sql: every row must say OK. Run after: the
-- last block must say APPLIED.

-- 1. chirp-migration.sql is in (the kind check and policy this file replaces).
select 'chirp applied' as check,
       (exists (select 1 from information_schema.columns
                where table_name = 'passport_occasion_moments' and column_name = 'bot_key'))::text as found,
       case when exists (select 1 from information_schema.columns
                where table_name = 'passport_occasion_moments' and column_name = 'bot_key')
            then 'OK' else 'STOP: apply chirp-migration.sql first' end as verdict;

-- 2. The reactions table is there (acknowledgements ride on it).
select 'reactions table' as check,
       (to_regclass('public.passport_occasion_reactions') is not null)::text as found,
       case when to_regclass('public.passport_occasion_reactions') is not null then 'OK' else 'STOP' end as verdict;

-- 3. Applied?
select 'announce applied' as check,
       (select count(*) from information_schema.columns
         where table_name = 'passport_occasion_moments'
           and column_name in ('reply_to', 'tag', 'href'))::text || '/3 columns, trigger ' ||
       (exists (select 1 from pg_trigger where tgname = 'passport_occasion_moments_reply'))::text as found,
       case when (select count(*) from information_schema.columns
                   where table_name = 'passport_occasion_moments'
                     and column_name in ('reply_to', 'tag', 'href')) = 3
                 and exists (select 1 from pg_trigger where tgname = 'passport_occasion_moments_reply')
                 and exists (select 1 from pg_constraint where conname = 'passport_occasion_moments_kind_check'
                             and pg_get_constraintdef(oid) like '%announce%')
            then 'APPLIED' else 'NOT APPLIED' end as verdict;
