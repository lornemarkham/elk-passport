-- ============================================================================
-- ROLLBACK for arena-migration.sql — deletes every check-in, ping and quest
-- on every night.
--
-- The arena migration adds four tables, three functions and their policies,
-- and alters nothing else, so dropping them returns the database to its
-- previous state. Hockey Night keeps working, and so does Arena Mode's map:
-- the page treats missing tables as "Arena Mode isn't switched on".
--
-- Everything these tables hold expires within hours anyway, but this still
-- refuses while any row exists unless confirmed in the same session, so a
-- live game is never wiped by accident.
-- ============================================================================
begin;

-- set local hockey.confirm_destroy_arena = 'yes';

do $$
declare n bigint := 0; k bigint;
begin
  if to_regclass('public.passport_occasion_checkins') is not null then
    execute 'select count(*) from public.passport_occasion_checkins' into k; n := n + k;
  end if;
  if to_regclass('public.passport_occasion_pings') is not null then
    execute 'select count(*) from public.passport_occasion_pings' into k; n := n + k;
  end if;
  if to_regclass('public.passport_occasion_quests') is not null then
    execute 'select count(*) from public.passport_occasion_quests' into k; n := n + k;
  end if;
  if n > 0 and coalesce(current_setting('hockey.confirm_destroy_arena', true), '') <> 'yes' then
    raise exception 'Refusing: % Arena Mode row(s) exist. Uncomment the set local line to destroy them.', n;
  end if;
end $$;

-- The quests' close policy reads the crew table; it goes first, by name,
-- rather than with a CASCADE that could reach further than meant.
do $$ begin
  if to_regclass('public.passport_occasion_quests') is not null then
    drop policy if exists passport_occasion_quests_close on public.passport_occasion_quests;
  end if;
end $$;

drop table if exists public.passport_occasion_quest_crew;
drop table if exists public.passport_occasion_quests;
drop table if exists public.passport_occasion_pings;
drop table if exists public.passport_occasion_checkins;
drop function if exists public.passport_arena_purge();
drop function if exists public.passport_arena_open(uuid, timestamptz);
drop function if exists public.passport_arena_stamp();

commit;
