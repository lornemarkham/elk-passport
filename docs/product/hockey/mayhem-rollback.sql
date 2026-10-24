-- ============================================================================
-- ROLLBACK for mayhem-migration.sql. Drops the challenges, the jury's votes,
-- team reactions and the mission ledger — every challenge ever issued goes
-- with them (points were never stored, so the Sycle Cup simply stops
-- counting them). Narrows the self-keyed Chirp Bot rule back to
-- night-migration.sql's; chal:/took:/oracle: lines already written stay, and
-- the page still checks them. Nothing else is touched.
-- ============================================================================

DROP FUNCTION IF EXISTS public.passport_occasion_mission_ledger(uuid);
DROP FUNCTION IF EXISTS public.passport_vote_challenge(uuid, boolean);
DROP FUNCTION IF EXISTS public.passport_perform_challenge(uuid, text);
DROP FUNCTION IF EXISTS public.passport_answer_challenge(uuid, text);
DROP FUNCTION IF EXISTS public.passport_issue_challenge(uuid, text, uuid, text, text, text, text);
DROP FUNCTION IF EXISTS public.passport_challenge_closed(uuid);
DROP TABLE IF EXISTS public.passport_occasion_team_reactions;
DROP TABLE IF EXISTS public.passport_occasion_challenge_votes;
DROP TABLE IF EXISTS public.passport_occasion_challenges;

do $$ begin
  if exists (select 1 from pg_constraint
             where conname = 'passport_occasion_moments_bot_self_check'
               and pg_get_constraintdef(oid) like '%oracle%') then
    alter table public.passport_occasion_moments
      drop constraint passport_occasion_moments_bot_self_check;
    alter table public.passport_occasion_moments
      add constraint passport_occasion_moments_bot_self_check check (
        bot_key is null
        or split_part(bot_key, ':', 1) not in ('team', 'arrive', 'couch', 'switch', 'mission', 'done')
        or split_part(bot_key, ':', 2) = actor_id::text) not valid;
  end if;
end $$;
