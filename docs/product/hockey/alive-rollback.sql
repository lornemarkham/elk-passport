-- ============================================================================
-- ROLLBACK for alive-migration.sql — forgets where everybody said they were
-- watching, and Chirp Bot's couch lines. Teams, picks, votes, people's own
-- messages and every other Chirp Bot line are untouched.
--
-- Hockey Night keeps working without it: the page treats the missing column
-- as "the couch isn't switched on yet".
--
-- Keep-data alternative: instead of dropping the column, only
--   revoke update (watching) on public.passport_occasion_members from authenticated;
-- and the page carries on reading it (nobody can change it until re-granted).
-- ============================================================================
begin;

delete from public.passport_occasion_moments where bot_key like 'couch:%';

alter table public.passport_occasion_moments
  drop constraint if exists passport_occasion_moments_bot_self_check;
alter table public.passport_occasion_moments
  add constraint passport_occasion_moments_bot_self_check check (
    bot_key is null
    or split_part(bot_key, ':', 1) not in ('team', 'arrive')
    or split_part(bot_key, ':', 2) = actor_id::text) not valid;

revoke update (watching) on public.passport_occasion_members from authenticated;
alter table public.passport_occasion_members
  drop constraint if exists passport_occasion_members_watching_check;
alter table public.passport_occasion_members drop column if exists watching;

commit;
