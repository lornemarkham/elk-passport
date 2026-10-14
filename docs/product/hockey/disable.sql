-- ============================================================================
-- KILL SWITCH — stop Hockey Night from growing, delete nothing.
--
-- After this, nobody can start a night or follow an invitation link
-- (the two functions are the only way in). Existing nights keep working for
-- their members. Reverse with enable.sql. Takes effect immediately; no deploy.
-- ============================================================================
revoke execute on function public.passport_create_occasion(text, text, timestamptz, jsonb, text, text, smallint, jsonb) from authenticated;
revoke execute on function public.passport_redeem_occasion_invite(text, text, text, smallint) from authenticated;
