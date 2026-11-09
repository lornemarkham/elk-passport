-- ============================================================================
-- MIGRATION — activities as a voted snow-day topic
-- Written on lane snow (feature/snow), 2026-11-08, mission "Snow Day — make
-- the mountain come alive"; promoted from docs/product/snow/ by the
-- integration workspace (M646), with the `activity` exclusion removed from
-- STORED_TOPICS in src/domain/snow/shared.ts in the same change.
--
-- Requires 20261103000000_passport_snow.sql. Apply it BEFORE the code that
-- carries it is deployed: that code lets a shared day store an activity, and
-- without this CHECK the insert fails. (Before this change, a day kept
-- on one phone votes on activities and a shared day says "Voting on
-- activities isn't switched on for shared days yet": no 500, no lost data.)
--
-- WHAT IT CHANGES: one CHECK. Votes and decisions reference the topic through
-- the composite foreign key (id, adventure_id, topic), so they accept the new
-- topic with no change. No grant, policy or function changes.
--
-- No BEGIN/COMMIT: the release runner applies every pending file with
-- psql --single-transaction and refuses a file that carries its own. Applying
-- by hand, run it with `psql --single-transaction -f`.
--
-- Idempotent: drops the constraint by name if present, then re-adds it.
-- Rollback (only once no 'activity' rows remain):
--   DELETE FROM public.passport_snow_proposals WHERE topic = 'activity';
--   then re-run this file with 'activity' removed from the list.
-- ============================================================================

ALTER TABLE public.passport_snow_proposals
  DROP CONSTRAINT IF EXISTS passport_snow_proposals_topic_check;

ALTER TABLE public.passport_snow_proposals
  ADD CONSTRAINT passport_snow_proposals_topic_check
  CHECK (topic IN ('date', 'mountain', 'transport', 'meeting', 'tickets',
                   'activity', 'meals', 'apres'));

-- Preflight after applying (expects one row, true):
--   SELECT pg_get_constraintdef(oid) LIKE '%activity%'
--   FROM pg_constraint WHERE conname = 'passport_snow_proposals_topic_check';
