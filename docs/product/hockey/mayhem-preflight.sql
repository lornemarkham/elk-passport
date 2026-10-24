-- ============================================================================
-- PRE-FLIGHT for mayhem-migration.sql — READ ONLY. Every row must say OK
-- (or "OK (not applied yet)"). Run it again after applying: the last rows
-- then say APPLIED.
-- ============================================================================
select 'occasions migration present' as check_name,
       count(*)::text as found,
       case when count(*) = 1 then 'OK' else 'STOP (apply migration.sql first)' end as verdict
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'passport_is_occasion_member'
union all
select 'night-migration.sql applied (onLock sealed for everybody)',
       (pg_get_functiondef('public.passport_occasion_answer_visible(uuid, text, uuid, uuid)'::regprocedure)
          like '%''onLock'' then v_locked%'
        and pg_get_functiondef('public.passport_occasion_answer_visible(uuid, text, uuid, uuid)'::regprocedure)
          not like '%''onLock'' then v_locked or exists%')::text,
       case when pg_get_functiondef('public.passport_occasion_answer_visible(uuid, text, uuid, uuid)'::regprocedure)
          not like '%''onLock'' then v_locked or exists%' then 'OK'
            else 'STOP (apply night-migration.sql first)' end
union all
select 'self-keyed Chirp Bot rule covers mission/done (night-migration.sql part 2)',
       coalesce(max(pg_get_constraintdef(oid)), 'none'),
       case when count(*) = 1 and max(pg_get_constraintdef(oid)) like '%mission%' then 'OK'
            else 'STOP (apply chirp, alive and night migrations first)' end
from pg_constraint where conname = 'passport_occasion_moments_bot_self_check'
union all
select 'challenges table',
       (to_regclass('public.passport_occasion_challenges') is not null)::text,
       case when to_regclass('public.passport_occasion_challenges') is null
            then 'OK (not applied yet)' else 'APPLIED' end
union all
select 'challenge votes table',
       (to_regclass('public.passport_occasion_challenge_votes') is not null)::text,
       case when to_regclass('public.passport_occasion_challenge_votes') is null
            then 'OK (not applied yet)' else 'APPLIED' end
union all
select 'team reactions table',
       (to_regclass('public.passport_occasion_team_reactions') is not null)::text,
       case when to_regclass('public.passport_occasion_team_reactions') is null
            then 'OK (not applied yet)' else 'APPLIED' end
union all
select 'mission ledger function',
       count(*)::text,
       case when count(*) = 0 then 'OK (not applied yet)' else 'APPLIED' end
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'passport_occasion_mission_ledger'
union all
select 'self-keyed rule covers chal/took/oracle',
       (count(*) > 0)::text,
       case when count(*) > 0 then 'APPLIED' else 'OK (not applied yet)' end
from pg_constraint where conname = 'passport_occasion_moments_bot_self_check'
  and pg_get_constraintdef(oid) like '%oracle%';
