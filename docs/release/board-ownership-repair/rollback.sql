-- ============================================================================
-- BOARD OWNERSHIP REPAIR — ROLLBACK                 !!! RE-OPENS BOTH HOLES !!!
-- Project: frllwwxesxbmmaadzfaf.   Package: docs/release/board-ownership-repair
--
-- Use ONLY if genuine board sharing is proven broken by the repair and cannot
-- wait for a fix-forward. Afterwards anyone signed in can again claim a shared
-- board (hole 1) and name somebody else as a board's owner (hole 2).
--
-- Puts back the three policies exactly as the baseline migration
-- (supabase/migrations/20260927000000_passport_baseline.sql) wrote them.
-- Changes no rows. One transaction, idempotent. Leaves the function
-- passport_board_has_members in place: after rollback nothing calls it, it is
-- read-only, and anon cannot execute it. To remove it too, run separately:
--   drop function if exists public.passport_board_has_members(text);
--
-- To restore the repair afterwards, run 02 again
-- (docs/product/group-adventures/boards-owner-claim-fix.sql).
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

DROP POLICY IF EXISTS "passport_board_members_self_claim" ON public.passport_board_members;
CREATE POLICY "passport_board_members_self_claim" ON "public"."passport_board_members" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) AND ("role" = 'owner'::"text") AND ("board_owner_id" = "auth"."uid"())));

DROP POLICY IF EXISTS "passport_board_members_owner_writes" ON public.passport_board_members;
CREATE POLICY "passport_board_members_owner_writes" ON "public"."passport_board_members" USING (("public"."passport_board_role"("board_id", "auth"."uid"()) = 'owner'::"text")) WITH CHECK (("public"."passport_board_role"("board_id", "auth"."uid"()) = 'owner'::"text"));

DROP POLICY IF EXISTS "passport_board_invites_owner_writes" ON public.passport_board_invites;
CREATE POLICY "passport_board_invites_owner_writes" ON "public"."passport_board_invites" USING (("public"."passport_board_role"("board_id", "auth"."uid"()) = 'owner'::"text")) WITH CHECK (("public"."passport_board_role"("board_id", "auth"."uid"()) = 'owner'::"text"));

COMMIT;
