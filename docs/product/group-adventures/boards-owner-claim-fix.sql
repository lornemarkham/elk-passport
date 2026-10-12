-- ============================================================================
-- PROPOSED FIX — board ownership claims and forged owners (live in production)
-- Lane: boards, 2026-10-12. NOT applied to any real project.
-- Supersedes the d1ba0be version of this file, which closed hole 1 only.
--
-- Apply in the SQL editor, as one statement batch. Idempotent. Changes no
-- rows. Needs no app deploy. Run boards-ownership-audit.sql before and after.
--
-- WHY board_owner_id MATTERS
--
-- `accessToBoard` (src/lib/collaboration/boardAccess.ts) asks Atlas for a
-- shared board ON BEHALF OF the `board_owner_id` the caller's membership row
-- names. Whoever can write a row or an invite naming Olive therefore reaches
-- Olive's Atlas board, as whatever role the row says.
--
-- HOLE 1 — claiming a shared board
--
-- The baseline `passport_board_members_self_claim` lets any signed-in person
-- insert (board_id = <any id>, user_id = me, role = 'owner',
-- board_owner_id = me) for ANY board id. That makes them owner in Passport:
-- they read the real members, invites, events and interest, and mint invites.
-- Proven by src/lib/data/boards-claim.stack.test.ts.
--
-- HOLE 2 — naming somebody else as owner
--
-- The baseline owner-writes policies check only that the writer is an owner of
-- the board in Passport; they never pin `board_owner_id`. So a Passport owner
-- can repoint their own row, write a member row, or mint an invite naming any
-- user as the board's owner. Combined with a self-claim on a board nobody is
-- on yet (every board never shared — and see NOTE below, probably every board
-- in production), that gives the claimant, or anyone redeeming their invite,
-- the real owner's Atlas board with read and write access.
-- Proven by src/lib/data/boards-owner-forgery.stack.test.ts.
--
-- THE FIX
--
-- 1. An owner row may be self-claimed only for a board nobody is on yet.
-- 2. Every row and invite an owner writes must name THE WRITER as the board's
--    owner (and an invite's creator must be the writer). A Passport row can
--    then only ever point Atlas at its writer's own boards, and Atlas remains
--    the authority on which boards those are.
--
-- Every write the app makes already satisfies (2): `ensureOwnerMembership`
-- writes user.id, `createInvite` writes access.ownerId (an owner's own id —
-- only an Atlas-proven owner can share), revoking leaves the columns as they
-- were, and redemption copies the invite's (now pinned) owner. DELETE has no
-- WITH CHECK, so an owner can always delete a row that violates (2).
--
-- RESIDUAL: somebody who learns the id of a board nobody is on can still
-- pre-claim it in their own name. That reaches nothing (their rows name them,
-- and Atlas holds no such board for them) but it stops the real owner sharing
-- it. Denial, not disclosure; an operator deletes the stray row (the audit
-- lists them as owner rows whose user has no such Atlas board).
--
-- NOTE — first shares are refused today. `ensureOwnerMembership` uses an
-- upsert. For INSERT ... ON CONFLICT DO UPDATE, Postgres also applies the
-- SELECT policy to the new row, and `passport_is_board_member` cannot see a
-- row not yet written, so the first owner row is always refused (error
-- swallowed). A plain INSERT of the same row — which anyone can send to
-- PostgREST — passes. This fix does not change that; the app fix is separate.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.passport_board_has_members(p_board_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists (select 1 from passport_board_members where board_id = p_board_id);
$$;
REVOKE ALL ON FUNCTION public.passport_board_has_members(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.passport_board_has_members(text) TO authenticated;

-- 1
DROP POLICY IF EXISTS "passport_board_members_self_claim" ON public.passport_board_members;
CREATE POLICY "passport_board_members_self_claim" ON public.passport_board_members
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND role = 'owner'
    AND board_owner_id = auth.uid()
    AND NOT public.passport_board_has_members(board_id));

-- 2
DROP POLICY IF EXISTS "passport_board_members_owner_writes" ON public.passport_board_members;
CREATE POLICY "passport_board_members_owner_writes" ON public.passport_board_members
  USING (public.passport_board_role(board_id, auth.uid()) = 'owner')
  WITH CHECK (
    public.passport_board_role(board_id, auth.uid()) = 'owner'
    AND board_owner_id = auth.uid());

DROP POLICY IF EXISTS "passport_board_invites_owner_writes" ON public.passport_board_invites;
CREATE POLICY "passport_board_invites_owner_writes" ON public.passport_board_invites
  USING (public.passport_board_role(board_id, auth.uid()) = 'owner')
  WITH CHECK (
    public.passport_board_role(board_id, auth.uid()) = 'owner'
    AND board_owner_id = auth.uid()
    AND created_by = auth.uid());

-- New function: tell PostgREST (delivered on commit).
NOTIFY pgrst, 'reload schema';

COMMIT;
