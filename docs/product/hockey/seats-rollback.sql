-- ============================================================================
-- ROLLBACK for seats-migration.sql — deletes every seat entered on every night.
--
-- The seats migration adds one table and its policies and alters nothing
-- else, so dropping that table returns the database to migration.sql's
-- state. Hockey Night itself keeps working: the page treats a missing seats
-- table as "seats are not available yet". The meeting point lives in
-- passport_occasions.details and is not touched (a stale `meetup` key there
-- is ignored by nothing and harmless; remove it with the update below if
-- wanted).
--
-- Refuses while any seat exists unless confirmed in the same session.
-- ============================================================================
begin;

-- set local hockey.confirm_destroy_seats = 'yes';

do $$
declare n bigint := 0;
begin
  if to_regclass('public.passport_occasion_seats') is not null then
    execute 'select count(*) from public.passport_occasion_seats' into n;
  end if;
  if n > 0 and coalesce(current_setting('hockey.confirm_destroy_seats', true), '') <> 'yes' then
    raise exception 'Refusing: % seat row(s) exist. Uncomment the set local line to destroy them.', n;
  end if;
end $$;

drop table if exists public.passport_occasion_seats;

-- Optional: forget every meeting point too.
-- update public.passport_occasions set details = details - 'meetup' where details ? 'meetup';

commit;
