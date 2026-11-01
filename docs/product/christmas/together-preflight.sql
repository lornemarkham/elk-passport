-- PREFLIGHT for together-migration.sql — read-only. Run first; every row
-- should say ok before applying.
select 'adventures core present' as check,
  case when to_regclass('public.passport_adventures') is not null
        and to_regprocedure('public.passport_is_adventure_member(text)') is not null
        and to_regprocedure('public.passport_is_adventure_owner(text)') is not null
       then 'ok' else 'MISSING — apply 20261021000000_passport_adventures.sql first' end as result
union all
select 'notices not yet present',
  case when to_regclass('public.passport_adventure_notices') is null then 'ok'
       else 'already applied (re-applying is harmless)' end
union all
select 'moments not yet present',
  case when to_regclass('public.passport_adventure_moments') is null then 'ok'
       else 'already applied (re-applying is harmless)' end;
