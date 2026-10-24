-- ============================================================================
-- ROLLBACK for plan-migration.sql — removes the "pregame-plans" rule rows. The
-- three-way "joining the pregame?" answers already written stay in
-- passport_occasion_responses, but without a rule row nobody can read or add
-- one (the policies require it), and the page leaves the question out again.
-- No vote, option, seat, meeting point or any other row is touched.
-- ============================================================================

delete from public.passport_occasion_prompts
where prompt_id = 'pregame-plans'
  and content is null
  and occasion_id in (
    select id from public.passport_occasions where template = 'sycle-hockey-night');
