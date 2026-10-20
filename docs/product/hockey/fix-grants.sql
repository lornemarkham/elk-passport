-- ============================================================================
-- CORRECTIVE: Hockey Night table grants, for a production project where
-- migration.sql was applied BEFORE 2026-10-20 (commit ee54cc4), i.e. the tables
-- exist but `authenticated` holds no privilege on them.
--
-- Symptom this fixes: every signed-in request to /hockey fails with
--   42501 permission denied for table passport_occasion_members
-- which the app renders as "Something went badly wrong."
--
-- This is exactly the GRANT block that migration.sql now contains, nothing
-- more. Additive and idempotent: it grants, never revokes; running it twice
-- changes nothing. It does NOT apply if the tables are missing (the GRANT
-- fails with 42P01) - in that case run preflight.sql, migration.sql and
-- verify.sql instead (migration.sql already includes these grants).
--
-- Run in the SQL editor of project frllwwxesxbmmaadzfaf. Never `supabase db push`.
-- Takes effect immediately; no deploy and no cache to clear.
-- ============================================================================
GRANT SELECT, INSERT, DELETE ON public.passport_occasions,
  public.passport_occasion_members, public.passport_occasion_invites,
  public.passport_occasion_prompts
  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.passport_occasion_options,
  public.passport_occasion_responses, public.passport_occasion_consents,
  public.passport_occasion_cues, public.passport_occasion_moments,
  public.passport_occasion_reactions
  TO authenticated;

-- Column-level UPDATE narrowing (already in the old migration; restated so this
-- file is sufficient on its own. Granting an existing grant is a no-op.)
GRANT UPDATE (display_name, emoji, hue, vibe, edge) ON public.passport_occasion_members TO authenticated;
GRANT UPDATE (title, starts_at, details, brief) ON public.passport_occasions TO authenticated;
GRANT UPDATE (label, revoked_at, expires_at) ON public.passport_occasion_invites TO authenticated;
GRANT UPDATE (resolution) ON public.passport_occasion_prompts TO authenticated;
