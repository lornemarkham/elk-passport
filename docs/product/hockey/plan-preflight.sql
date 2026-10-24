-- ============================================================================
-- PRE-FLIGHT for plan-migration.sql — READ ONLY. Every row must say OK.
-- After applying, run it again: the last row then says APPLIED.
-- ============================================================================
select 'occasion prompt rules table present' as check_name,
       count(*)::text as found,
       case when count(*) = 1 then 'OK' else 'STOP (apply migration.sql first)' end as verdict
from information_schema.tables
where table_schema = 'public' and table_name = 'passport_occasion_prompts'
union all
select 'rule rows are unique per (night, question)',
       count(*)::text,
       case when count(*) >= 1 then 'OK' else 'STOP' end
from pg_constraint
where conrelid = 'public.passport_occasion_prompts'::regclass
  and contype in ('p', 'u')
  and pg_get_constraintdef(oid) like '%occasion_id, prompt_id%'
union all
select 'hockey nights that exist',
       count(*)::text,
       'OK'
from public.passport_occasions where template = 'sycle-hockey-night'
union all
select 'hockey nights still without the pregame-plans rule',
       count(*)::text,
       case when count(*) = 0 then 'APPLIED' else 'OK (not applied yet)' end
from public.passport_occasions o
where o.template = 'sycle-hockey-night'
  and not exists (
    select 1 from public.passport_occasion_prompts p
    where p.occasion_id = o.id and p.prompt_id = 'pregame-plans');
