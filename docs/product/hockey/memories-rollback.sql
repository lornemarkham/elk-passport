-- ============================================================================
-- ROLLBACK for memories-migration.sql — deletes every photo on every night.
--
-- The migration adds one table and its policies and alters nothing else.
-- Hockey Night keeps working without it: the page treats a missing photos
-- table as "photos aren't switched on yet".
--
-- Refuses while any photo exists unless confirmed in the same session.
-- ============================================================================
begin;

-- set local hockey.confirm_destroy_photos = 'yes';

do $$
declare n bigint := 0;
begin
  if to_regclass('public.passport_occasion_photos') is not null then
    execute 'select count(*) from public.passport_occasion_photos' into n;
  end if;
  if n > 0 and coalesce(current_setting('hockey.confirm_destroy_photos', true), '') <> 'yes' then
    raise exception 'Refusing: % photo row(s) exist. Uncomment the set local line to destroy them.', n;
  end if;
end $$;

drop table if exists public.passport_occasion_photos;

commit;
