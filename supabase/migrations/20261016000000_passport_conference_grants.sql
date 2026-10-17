-- Conference tables: the table privileges the two earlier migrations assumed.
--
-- WHY THIS EXISTS
--
-- 20261012000000_passport_conferences.sql and
-- 20261014000000_passport_conference_arrivals.sql only REVOKE, and GRANT a few
-- UPDATE columns. They relied on Supabase's default privileges to give
-- `authenticated` SELECT/INSERT/DELETE on new public tables. The production
-- project (frllwwxesxbmmaadzfaf) does not apply those defaults. On 2026-10-16
-- a signed-in person reading their own memberships got
-- `42501 permission denied for table passport_conference_members`, and
-- /conferences crashed for every signed-in visitor. The Passport baseline
-- states its grants outright (see its "grants" section); conferences now do
-- too.
--
-- WHAT IT GRANTS
--
-- Exactly what supabaseStore.ts and the arrivals store issue, nothing wider.
-- RLS still decides which rows; these grants only let the policies run.
-- `anon` gets nothing. No table-wide UPDATE: the column grants in the earlier
-- migrations stand, and codes are never updated (they are replaced). No DELETE
-- on conferences or invites: removal goes through passport_conference_remove.
-- Arrival writes go through passport_conference_arrivals_save.
--
-- GRANT is idempotent, so running this twice changes nothing. It must run
-- after both earlier conference migrations.

GRANT SELECT, INSERT ON public.passport_conferences TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.passport_conference_codes TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.passport_conference_members TO authenticated;
GRANT SELECT, INSERT ON public.passport_conference_invites TO authenticated;
GRANT SELECT, DELETE ON public.passport_conference_arrivals TO authenticated;
