-- ============================================================================
-- ROLLBACK for shared-migration.sql (passport_snow_*). Paste into the SQL
-- editor. Drops ONLY Snow's own tables and functions; the adventure core and
-- every other kind (Hockey Night, Date Night, Christmas, conference) are not
-- touched. This DELETES every shared snow day's plan, votes, chat, points,
-- predictions, photos and moments. The adventures themselves (members,
-- invites, title, date) stay, as ordinary adventures of kind 'snow-day'.
-- Take a backup first if anyone has used it.
-- ============================================================================
DROP TRIGGER IF EXISTS passport_snow_members_gone ON public.passport_adventure_members;

DROP TABLE IF EXISTS
  public.passport_snow_idea_votes, public.passport_snow_guesses,
  public.passport_snow_decisions, public.passport_snow_votes,
  public.passport_snow_completions, public.passport_snow_packed,
  public.passport_snow_checkins, public.passport_snow_songs,
  public.passport_snow_ideas, public.passport_snow_predictions,
  public.passport_snow_moments, public.passport_snow_challenges,
  public.passport_snow_posts, public.passport_snow_proposals,
  public.passport_snow_people, public.passport_snow_days
  CASCADE;

DROP FUNCTION IF EXISTS public.passport_snow_member_gone();
DROP FUNCTION IF EXISTS public.passport_snow_moment_cap();
DROP FUNCTION IF EXISTS public.passport_snow_cap();
DROP FUNCTION IF EXISTS public.passport_snow_touch();
DROP FUNCTION IF EXISTS public.passport_is_snow_owner(text);
DROP FUNCTION IF EXISTS public.passport_is_snow_member(text);

NOTIFY pgrst, 'reload schema';
