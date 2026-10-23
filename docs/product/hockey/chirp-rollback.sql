-- ============================================================================
-- ROLLBACK for chirp-migration.sql — forgets everybody's team and deletes
-- every Chirp Bot line on every night. People's own messages are untouched.
--
-- Hockey Night keeps working without it: the page treats the missing
-- columns as "teams and Chirp Bot aren't switched on yet".
-- ============================================================================
begin;

delete from public.passport_occasion_moments where kind = 'chirp';

drop policy if exists passport_occasion_moments_say on public.passport_occasion_moments;
create policy passport_occasion_moments_say on public.passport_occasion_moments
  for insert to authenticated with check (
    actor_id = auth.uid() and kind in ('note', 'photo')
    and passport_is_occasion_member(occasion_id, auth.uid()));

drop index if exists public.passport_occasion_moments_bot_once;
alter table public.passport_occasion_moments
  drop constraint if exists passport_occasion_moments_bot_check;
alter table public.passport_occasion_moments
  drop constraint if exists passport_occasion_moments_bot_self_check;
alter table public.passport_occasion_moments
  drop constraint if exists passport_occasion_moments_kind_check;
alter table public.passport_occasion_moments
  add constraint passport_occasion_moments_kind_check
  check (kind in ('note', 'join', 'photo'));
alter table public.passport_occasion_moments
  drop column if exists bot_key,
  drop column if exists bot_line,
  drop column if exists bot_sig;

revoke update (nhl_team) on public.passport_occasion_members from authenticated;
alter table public.passport_occasion_members
  drop constraint if exists passport_occasion_members_nhl_team_check;
alter table public.passport_occasion_members drop column if exists nhl_team;

commit;
