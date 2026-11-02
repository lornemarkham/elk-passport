-- ============================================================================
-- ROLLBACK for 20261103000000_passport_snow.sql (passport_snow_*). Paste into the SQL
-- editor. Drops ONLY Snow's own tables and functions; the adventure core and
-- every other kind (Hockey Night, Date Night, Christmas, conference) are not
-- touched. This DELETES every shared snow day's plan, votes, chat, points
-- and predictions. The adventures themselves (members, invites, title, date)
-- stay, as ordinary adventures of kind 'snow-day'.
--
-- ADR 014: a snow day's announcements and photos are the CORE's rows
-- (passport_adventure_notices / _moments), not Snow's, so this does not
-- delete them. They stay with their adventures, readable by its members
-- through the core's policies. To remove them as well (permanent), run the
-- optional block at the end.
-- Take a backup first if anyone has used it.
-- ============================================================================
DROP TRIGGER IF EXISTS passport_snow_members_gone ON public.passport_adventure_members;
DROP TRIGGER IF EXISTS passport_snow_moment_guard ON public.passport_adventure_moments;

DROP TABLE IF EXISTS
  public.passport_snow_idea_votes, public.passport_snow_guesses,
  public.passport_snow_decisions, public.passport_snow_votes,
  public.passport_snow_completions, public.passport_snow_packed,
  public.passport_snow_checkins, public.passport_snow_songs,
  public.passport_snow_ideas, public.passport_snow_predictions,
  public.passport_snow_challenges,
  public.passport_snow_posts, public.passport_snow_proposals,
  public.passport_snow_people, public.passport_snow_days
  CASCADE;

DROP FUNCTION IF EXISTS public.passport_snow_decide(text, text, uuid, boolean, date, text, text);
DROP FUNCTION IF EXISTS public.passport_snow_start(text, text, text, text, boolean, text);
DROP FUNCTION IF EXISTS public.passport_snow_member_gone();
DROP FUNCTION IF EXISTS public.passport_snow_moment_guard();
DROP FUNCTION IF EXISTS public.passport_snow_cap();
DROP FUNCTION IF EXISTS public.passport_snow_touch();
DROP FUNCTION IF EXISTS public.passport_is_snow_owner(text);
DROP FUNCTION IF EXISTS public.passport_is_snow_member(text);

NOTIFY pgrst, 'reload schema';

-- OPTIONAL, PERMANENT — also remove what snow days shared on the core.
-- Uncomment only if you mean it.
-- DELETE FROM public.passport_adventure_moments m USING public.passport_adventures a
--   WHERE a.id = m.adventure_id AND a.kind = 'snow-day';
-- DELETE FROM public.passport_adventure_notices n USING public.passport_adventures a
--   WHERE a.id = n.adventure_id AND a.kind = 'snow-day';
