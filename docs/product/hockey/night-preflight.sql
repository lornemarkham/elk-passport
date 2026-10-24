-- ============================================================================
-- PRE-FLIGHT for night-migration.sql — READ ONLY. Every row must say OK.
-- After applying, run it again: the last two rows then say APPLIED.
-- ============================================================================
select 'answer visibility function present' as check_name,
       count(*)::text as found,
       case when count(*) = 1 then 'OK' else 'STOP (apply migration.sql first)' end as verdict
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'passport_occasion_answer_visible'
union all
select 'responses read through it (RLS policy)',
       coalesce(string_agg(policyname, ', '), 'none'),
       case when count(*) >= 1 then 'OK' else 'STOP' end
from pg_policies
where tablename = 'passport_occasion_responses' and cmd = 'SELECT'
  and qual like '%passport_occasion_answer_visible%'
union all
select 'authenticated may execute it',
       has_function_privilege('authenticated',
         'public.passport_occasion_answer_visible(uuid, text, uuid, uuid)', 'execute')::text,
       case when has_function_privilege('authenticated',
         'public.passport_occasion_answer_visible(uuid, text, uuid, uuid)', 'execute')
            then 'OK' else 'STOP' end
union all
select 'onLock still opens to anyone who answered (the leak)',
       (pg_get_functiondef('public.passport_occasion_answer_visible(uuid, text, uuid, uuid)'::regprocedure)
          like '%''onLock'' then v_locked or exists%')::text,
       case when pg_get_functiondef('public.passport_occasion_answer_visible(uuid, text, uuid, uuid)'::regprocedure)
          like '%''onLock'' then v_locked or exists%' then 'OK (not applied yet)' else 'APPLIED' end
union all
select 'alive-migration.sql applied (self-keyed rule covers couch)',
       coalesce(max(pg_get_constraintdef(oid)), 'none'),
       case when count(*) = 1 and max(pg_get_constraintdef(oid)) like '%couch%' then 'OK'
            else 'STOP (apply chirp-migration.sql then alive-migration.sql first)' end
from pg_constraint where conname = 'passport_occasion_moments_bot_self_check'
union all
select 'self-keyed rule covers mission/done',
       (count(*) > 0)::text,
       case when count(*) > 0 then 'APPLIED' else 'OK (not applied yet)' end
from pg_constraint where conname = 'passport_occasion_moments_bot_self_check'
  and pg_get_constraintdef(oid) like '%mission%';
