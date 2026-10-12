-- ============================================================================
-- ROLLBACK for migration.sql — DESTRUCTIVE: deletes every Hockey Night.
--
-- The migration only ADDS objects named passport_occasion* /
-- passport_*occasion*; it alters nothing that existed. So removing exactly
-- those objects returns the database to its previous state. Passport's
-- baseline tables, Atlas's tables and the shared migration history are not
-- touched.
--
-- Prefer disable.sql first (stops new nights and joins, deletes nothing).
-- Use this only if the data itself must go, or to start clean after a bad
-- partial apply.
--
-- It REFUSES to run while any occasion exists, unless you say so in the same
-- session by uncommenting the `set local` line below. Export first (see
-- PRODUCTION-READINESS.md, "Rollback").
-- ============================================================================
begin;

-- set local hockey.confirm_destroy = 'yes';

do $$
declare n bigint := 0;
begin
  -- Dynamic, so this also runs (and does nothing) when the tables are already gone.
  if to_regclass('public.passport_occasions') is not null then
    execute 'select count(*) from public.passport_occasions' into n;
  end if;
  if n > 0 and coalesce(current_setting('hockey.confirm_destroy', true), '') <> 'yes' then
    raise exception 'Refusing: % occasion(s) exist. Export them, then uncomment the set local line.', n;
  end if;
end $$;

drop table if exists public.passport_occasion_reactions cascade;
drop table if exists public.passport_occasion_moments cascade;
drop table if exists public.passport_occasion_cues cascade;
drop table if exists public.passport_occasion_consents cascade;
drop table if exists public.passport_occasion_responses cascade;
drop table if exists public.passport_occasion_options cascade;
drop table if exists public.passport_occasion_prompts cascade;
drop table if exists public.passport_occasion_invites cascade;
drop table if exists public.passport_occasion_members cascade;
drop table if exists public.passport_occasions cascade;

drop function if exists public.passport_create_occasion(text, text, timestamptz, jsonb, text, text, smallint, jsonb);
drop function if exists public.passport_redeem_occasion_invite(text, text, text, smallint);
drop function if exists public.passport_describe_occasion_invite(text);
drop function if exists public.passport_occasion_prompt_visible(uuid, uuid, uuid, uuid);
drop function if exists public.passport_occasion_answer_visible(uuid, text, uuid, uuid);
drop function if exists public.passport_occasion_prompt_locked(uuid, text);
drop function if exists public.passport_is_occasion_member(uuid, uuid);
drop function if exists public.passport_occasion_role(uuid, uuid);

commit;
