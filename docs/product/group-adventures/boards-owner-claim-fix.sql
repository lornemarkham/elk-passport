-- ============================================================================
-- PROPOSED FIX — passport_board_members_self_claim (live in production)
-- Lane: boards, 2026-10-12. NOT applied to any real project.
--
-- THE HOLE
--
-- The baseline policy lets any signed-in person insert
--   (board_id = <any id>, user_id = me, role = 'owner', board_owner_id = me)
-- for ANY board id, including a board somebody else already shares. Having
-- that row makes `passport_board_role(board, me) = 'owner'`, so the claimant
-- can then read the real members, read and create invites (naming the real
-- owner as `board_owner_id`), read events and interest. A second account
-- redeeming such an invite gets a membership row pointing at the real owner,
-- and `accessToBoard` then fetches the real board from Atlas on their behalf.
--
-- Who can exploit it: anyone who knows a board id and its owner's user id —
-- most plausibly a member the owner removed. Proven against the baseline by
-- docs/product/group-adventures/verification/boards-claim.mjs.
--
-- THE FIX
--
-- An owner row may be self-claimed only for a board nobody is on yet. Passport
-- writes that row the moment a board is created (`POST /api/boards`) or first
-- shared, so legitimate claims are unaffected; Atlas remains the authority
-- that the claimant owns the board (Passport only ever asks Atlas on the
-- owner's behalf).
--
-- Residual: a board created before sharing existed, never shared, whose id an
-- attacker learns, can still be pre-claimed. That leaks nothing (there are no
-- other members, invites or events to read, and Atlas serves the board only
-- to its owner) but it blocks the real owner from sharing it: their own owner
-- row is now refused. Denial, not disclosure; fixable by an operator deleting
-- the stray row.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.passport_board_has_members(p_board_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists (select 1 from passport_board_members where board_id = p_board_id);
$$;
REVOKE ALL ON FUNCTION public.passport_board_has_members(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.passport_board_has_members(text) TO authenticated;

DROP POLICY IF EXISTS "passport_board_members_self_claim" ON public.passport_board_members;
CREATE POLICY "passport_board_members_self_claim" ON public.passport_board_members
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND role = 'owner'
    AND board_owner_id = auth.uid()
    AND NOT public.passport_board_has_members(board_id));
