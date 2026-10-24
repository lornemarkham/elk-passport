-- ============================================================================
-- ROLLBACK for crew-migration.sql — deletes every GPS hint, summon, snack run
-- and request on every night.
--
-- The Crew migration adds five tables, two functions and their policies, and
-- alters nothing of Arena Mode's. Dropping them returns the database to
-- arena-migration.sql's state. Arena Mode keeps working: the page treats
-- missing Crew tables as "the Crew isn't switched on".
--
-- Refuses while any row exists unless confirmed in the same session.
-- ============================================================================
begin;

-- set local hockey.confirm_destroy_crew = 'yes';

do $$
declare n bigint := 0; k bigint; t text;
begin
  foreach t in array array['passport_occasion_gps_hints', 'passport_occasion_summons',
                           'passport_occasion_snack_runs'] loop
    if to_regclass('public.' || t) is not null then
      execute format('select count(*) from public.%I', t) into k; n := n + k;
    end if;
  end loop;
  if n > 0 and coalesce(current_setting('hockey.confirm_destroy_crew', true), '') <> 'yes' then
    raise exception 'Refusing: % Crew row(s) exist. Uncomment the set local line to destroy them.', n;
  end if;
end $$;

drop table if exists public.passport_occasion_snack_items;
drop table if exists public.passport_occasion_snack_runs;
drop table if exists public.passport_occasion_summon_replies;
drop table if exists public.passport_occasion_summons;
drop table if exists public.passport_occasion_gps_hints;

drop function if exists public.passport_crew_purge();
drop function if exists public.passport_crew_stamp();

commit;
