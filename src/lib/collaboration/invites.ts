import "server-only";
import { randomBytes } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BoardRole } from "./boardAccess";

/**
 * **A share link, and nothing more.**
 *
 * No email integration, no SMS, no pending-invitation inbox. Somebody copies a
 * URL and sends it however they already talk to that person — which is the only
 * mechanism that works identically on a phone, on a desktop, and in whatever
 * client comes next, and is genuinely enough for a first version.
 *
 * ## The token is the credential
 *
 * 32 bytes from `randomBytes`, base64url. Not a uuid: a uuid reads like an
 * identifier somebody may safely paste into a support ticket, and this is a
 * secret. It can expire, it can be revoked, and it can never name a role above
 * `editor`, because the column it is written to will not hold one. **No link
 * ever grants ownership.**
 *
 * Redemption goes through `passport_redeem_board_invite`, a SECURITY DEFINER
 * function, because the person following the link is by definition not yet a
 * member and so cannot read the invite that would let them become one.
 */
export type InviteRole = Extract<BoardRole, "editor" | "viewer">;

export interface BoardInvite {
  readonly token: string;
  readonly role: InviteRole;
  readonly createdAt: string;
  readonly expiresAt: string | null;
  readonly revokedAt: string | null;
}

function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function createInvite(input: {
  boardId: string;
  boardOwnerId: string;
  createdBy: string;
  role: InviteRole;
  /** Days until it stops working. `null` for a link that does not expire. */
  expiresInDays?: number | null;
}): Promise<BoardInvite> {
  const supabase = await createSupabaseServerClient();

  const expiresAt =
    input.expiresInDays == null
      ? null
      : new Date(
          Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000,
        ).toISOString();

  const row = {
    token: newToken(),
    board_id: input.boardId,
    board_owner_id: input.boardOwnerId,
    role: input.role,
    created_by: input.createdBy,
    expires_at: expiresAt,
  };

  const { error } = await supabase.from("passport_board_invites").insert(row);
  if (error) throw new Error(`Could not create a link: ${error.message}`);

  return {
    token: row.token,
    role: row.role,
    createdAt: new Date().toISOString(),
    expiresAt,
    revokedAt: null,
  };
}

export async function invitesFor(boardId: string): Promise<BoardInvite[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("passport_board_invites")
    .select("token, role, created_at, expires_at, revoked_at")
    .eq("board_id", boardId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  return (
    (data as
      | {
          token: string;
          role: InviteRole;
          created_at: string;
          expires_at: string | null;
          revoked_at: string | null;
        }[]
      | null) ?? []
  ).map((r) => ({
    token: r.token,
    role: r.role,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    revokedAt: r.revoked_at,
  }));
}

/**
 * Stop a link working.
 *
 * A revocation, not a delete: an owner who kills a link should be able to see
 * that they did. People already admitted through it stay — removing them is a
 * separate, deliberate act.
 */
export async function revokeInvite(
  boardId: string,
  token: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("passport_board_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("board_id", boardId)
    .eq("token", token);

  if (error) throw new Error(`Could not revoke that link: ${error.message}`);
}

/**
 * What a link offers, for somebody who has not accepted it — possibly not even
 * signed in.
 *
 * Says whether it still works and what access it grants. **Not the board's name
 * and not its contents**: those belong to the owner, and a link that leaked
 * would otherwise leak them too. Enough context to understand the invitation,
 * which is all the landing page needs.
 */
export async function describeInvite(
  token: string,
): Promise<{ valid: boolean; role: InviteRole } | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("passport_describe_board_invite", {
    p_token: token,
  });

  if (error || !Array.isArray(data) || data.length === 0) return null;

  const row = data[0] as { valid: boolean; role: InviteRole };
  return { valid: row.valid, role: row.role };
}

/**
 * Accept a link. Returns the board id joined, or `null` if the link is dead.
 *
 * Idempotent by design: following the same link twice, or one sent to somebody
 * already on the board, lands them on the board rather than reporting an error
 * at them. It never changes an existing role, so a viewer cannot re-redeem
 * their way up and an owner cannot be demoted by their own link.
 */
export async function redeemInvite(token: string): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("passport_redeem_board_invite", {
    p_token: token,
  });

  if (error) throw new Error(`Could not join that board: ${error.message}`);
  return typeof data === "string" ? data : null;
}
