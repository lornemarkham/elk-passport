-- ============================================================================
-- OPTIONAL — CONTAIN FORGED INVITES                   (writes; human decision)
-- Project: frllwwxesxbmmaadzfaf.   Package: docs/release/board-ownership-repair
--
-- Run ONLY if 01-preflight.sql or 03-verify.sql reports
-- "audit: LIVE invites naming someone else" above 0, and you have read the rows
-- with docs/product/group-adventures/boards-ownership-audit.sql.
--
-- Why: the repair stops NEW forged invites. An invite forged BEFORE the repair
-- still works: passport_redeem_board_invite copies whatever owner the invite
-- names. This marks exactly those invites revoked. It deletes nothing (the row
-- stays, with revoked_at set, as evidence) and touches no member row.
--
-- It does NOT remove people who already joined through a forged invite, or
-- forged member/owner rows. Those are listed by the audit and need a person to
-- decide; deleting a membership is not something to do from a template.
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';

UPDATE public.passport_board_invites i
SET revoked_at = now()
WHERE i.revoked_at IS NULL
  AND (i.expires_at IS NULL OR i.expires_at >= now())
  AND (i.board_owner_id <> i.created_by
       OR NOT EXISTS (SELECT 1 FROM public.passport_board_members o
                      WHERE o.board_id = i.board_id AND o.role = 'owner' AND o.user_id = i.created_by));

-- The predicate is the audit's "LIVE invites naming someone else", verbatim,
-- so the rows changed are exactly the ones that count reported. Re-run
-- 03-verify.sql afterwards: that count should read 0.

COMMIT;
