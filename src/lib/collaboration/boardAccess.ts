import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PassportUser } from "@/lib/auth/currentUser";
import { getBoardFor, listBoardsFor } from "@/lib/data/boards-server";
import type { Board } from "@/lib/data/boards-repo";

/**
 * **Who may reach which board, and what they may do there.**
 *
 * ## Two authorities, deliberately not merged
 *
 * ```
 * Atlas     owns the board and its contents. Answers only for its owner.
 * Passport  owns who else may reach it. Never tells Atlas that sharing exists.
 * ```
 *
 * So a shared read works like this: Passport looks up the membership row, which
 * carries the *owner's* id, and then asks Atlas for the board **on the owner's
 * behalf**. Atlas's rule — never cross owners — is completely untouched, and it
 * never learns what a collaborator is. Putting members in Atlas would have
 * given the knowledge backend a model of a person's friends, which it has no
 * business holding and no way to authenticate.
 *
 * ## Roles
 *
 * ```
 * owner   created it; may share, rename, delete, and everything below
 * editor  may add and remove items
 * viewer  may look
 * ```
 *
 * Three, and no more. A fourth is a product decision nobody has made, and the
 * moment they are configurable this has become an RBAC system rather than a
 * sharing feature.
 */
export type BoardRole = "owner" | "editor" | "viewer";

export interface BoardAccess {
  readonly board: Board;
  readonly role: BoardRole;
  /** The Passport user whose Atlas boards this one lives in. */
  readonly ownerId: string;
}

export const canEdit = (role: BoardRole): boolean =>
  role === "owner" || role === "editor";

export const canShare = (role: BoardRole): boolean => role === "owner";

interface MembershipRow {
  board_id: string;
  board_owner_id: string;
  role: BoardRole;
}

async function membershipsOf(user: PassportUser): Promise<MembershipRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("passport_board_members")
    .select("board_id, board_owner_id, role")
    .eq("user_id", user.id);
  return (data as MembershipRow[] | null) ?? [];
}

/**
 * Every board this person can reach, owned first, then shared with them.
 *
 * Ownership is read from **Atlas**, not from the membership table — a board
 * somebody made is theirs whether or not a Passport row ever recorded it, which
 * keeps every board created before sharing existed working exactly as it did.
 * Membership only ever *adds* reach.
 */
export async function boardsVisibleTo(
  user: PassportUser,
): Promise<readonly BoardAccess[]> {
  const [owned, memberships] = await Promise.all([
    listBoardsFor(user.id).catch(() => [] as Board[]),
    membershipsOf(user),
  ]);

  const access: BoardAccess[] = owned.map((board) => ({
    board,
    role: "owner" as const,
    ownerId: user.id,
  }));

  const alreadyOwned = new Set(owned.map((b) => b.id));

  const shared = memberships.filter(
    (m) => m.role !== "owner" && !alreadyOwned.has(m.board_id),
  );

  // One Atlas read per shared board. Fine at this scale, and honest: there is
  // no endpoint that fetches somebody else's board by id, because there should
  // not be one.
  const fetched = await Promise.all(
    shared.map(async (m) => {
      const board = await getBoardFor(m.board_id, m.board_owner_id).catch(
        () => null,
      );
      return board ? { board, role: m.role, ownerId: m.board_owner_id } : null;
    }),
  );

  for (const entry of fetched) if (entry) access.push(entry);

  return access;
}

/**
 * This person's access to one board, or `null`.
 *
 * `null` covers "no such board", "not yours" and "not shared with you"
 * identically, so changing an id in a URL tells the changer nothing.
 */
export async function accessToBoard(
  user: PassportUser,
  boardId: string,
): Promise<BoardAccess | null> {
  const owned = await getBoardFor(boardId, user.id).catch(() => null);
  if (owned) return { board: owned, role: "owner", ownerId: user.id };

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("passport_board_members")
    .select("board_id, board_owner_id, role")
    .eq("user_id", user.id)
    .eq("board_id", boardId)
    .maybeSingle<MembershipRow>();

  if (!data) return null;

  const board = await getBoardFor(boardId, data.board_owner_id).catch(
    () => null,
  );
  if (!board) return null;

  return { board, role: data.role, ownerId: data.board_owner_id };
}

/**
 * Record that a board's creator owns it, so they can later share it.
 *
 * Called when a board is created. Sharing needs an owner row to exist — the
 * "may I add a member" policy asks this table who the owner is — and a board
 * with no row is simply one that has never been shared. Failure is swallowed on
 * purpose: not being able to write this must not stop a board from being
 * created, and `ensureOwnerMembership` runs again the first time somebody
 * actually shares.
 */
export async function ensureOwnerMembership(
  user: PassportUser,
  boardId: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.from("passport_board_members").upsert(
    {
      board_id: boardId,
      board_owner_id: user.id,
      user_id: user.id,
      role: "owner",
    },
    { onConflict: "board_id,user_id" },
  );
}

export interface BoardMember {
  readonly userId: string;
  readonly role: BoardRole;
  readonly displayName: string;
  readonly isYou: boolean;
}

/**
 * Who is on this board.
 *
 * Names come from `passport_profiles`, and a member who has never set one shows
 * as "A traveller" rather than a uuid — Passport does not expose an email
 * address to somebody just because they share a board.
 */
export async function membersOf(
  user: PassportUser,
  boardId: string,
): Promise<readonly BoardMember[]> {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("passport_board_members")
    .select("user_id, role")
    .eq("board_id", boardId);

  const rows = (data as { user_id: string; role: BoardRole }[] | null) ?? [];
  if (rows.length === 0) return [];

  const { data: profiles } = await supabase
    .from("passport_profiles")
    .select("user_id, display_name")
    .in(
      "user_id",
      rows.map((r) => r.user_id),
    );

  const nameById = new Map(
    (
      (profiles as { user_id: string; display_name: string | null }[] | null) ??
      []
    ).map((p) => [p.user_id, p.display_name?.trim() || null]),
  );

  const order: Record<BoardRole, number> = { owner: 0, editor: 1, viewer: 2 };

  return rows
    .map((row) => ({
      userId: row.user_id,
      role: row.role,
      displayName:
        row.user_id === user.id
          ? (nameById.get(row.user_id) ?? user.displayName)
          : (nameById.get(row.user_id) ?? "A traveller"),
      isYou: row.user_id === user.id,
    }))
    .sort((a, b) => order[a.role] - order[b.role]);
}

/** Remove somebody from a board. Owners only; RLS enforces that too. */
export async function removeMember(
  boardId: string,
  userId: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("passport_board_members")
    .delete()
    .eq("board_id", boardId)
    .eq("user_id", userId);

  if (error) throw new Error(`Could not remove that member: ${error.message}`);
}
