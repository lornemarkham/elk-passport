-- ============================================================================
-- PROPOSED MIGRATION — Hockey Night: Plan, the pregame hype machine
--   (a rule row for "Are you joining the pregame?" on nights that already
--    exist)
--
-- Proposed for: supabase/migrations/<timestamp>_passport_occasion_plan.sql
-- REQUIRES migration.sql. Run plan-preflight.sql first; paste into the SQL
-- editor; never `supabase db push`. Order against the others does not matter.
--
-- A template question exists on a night only if the night has its rule row
-- (passport_occasion_prompts); `passport_create_occasion` writes one per
-- question when a night is *created*. Plan now asks "Are you joining the
-- pregame?" (Joining pregame / Meeting at the arena / Not sure yet), so a night
-- created before this release has no row for it. Without the row the page
-- simply leaves that one question out (nothing breaks, nothing is faked), and
-- the pregame winner is still the default meeting point. With the row, the
-- three answers are saved, shown to the group and changeable until puck drop.
--
-- The row is the same as the one a new night gets from templateRules():
--   pregame-plans · reveal immediate · locks at puck drop (offset 0) ·
--   not open to suggestions.
--
-- Insert-only, `on conflict do nothing`: applying it twice changes nothing,
-- no existing row, answer or vote is touched, and the "where are we meeting?"
-- rows (meet-spot) stay exactly as they are. Rollback: plan-rollback.sql.
-- ============================================================================

insert into public.passport_occasion_prompts
  (occasion_id, prompt_id, reveal, lock_offset_minutes, open_to_suggestions)
select o.id, 'pregame-plans', 'immediate', 0, false
from public.passport_occasions o
where o.template = 'sycle-hockey-night'
on conflict (occasion_id, prompt_id) do nothing;
