import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PassportUser } from "@/lib/auth/currentUser";
import type { InterestRow } from "./boards-interest";

/**
 * **Where "I'm interested" is kept: `passport_board_interest`.**
 *
 * Read and written through the caller's own session, so row-level security is
 * the boundary — members read a board's marks, a person writes only their own.
 * The route checks board access as well; RLS is there so a mistake in a
 * handler cannot become somebody else's raised hand.
 *
 * ## The table is proposed, not yet migrated
 *
 * Schema belongs to the contracts lane, so the migration travels in the
 * integration report rather than in `supabase/migrations/`. Until it lands
 * every call here fails, and fails as `InterestUnavailable` — which the board
 * renders as "can't be recorded yet". It never degrades into an empty list,
 * because "nobody is interested" and "Passport could not ask" are different
 * sentences and only one of them would be true.
 */
const TABLE = "passport_board_interest";

export class InterestUnavailable extends Error {
  constructor(cause: string) {
    super(`Interest is unavailable: ${cause}`);
    this.name = "InterestUnavailable";
  }
}

export interface BoardInterest {
  readonly rows: readonly InterestRow[];
  /** The board's current members — the only people whose marks count. */
  readonly memberIds: ReadonlySet<string>;
}

export async function readBoardInterest(
  boardId: string,
): Promise<BoardInterest> {
  const supabase = await createSupabaseServerClient();
  const [interest, members] = await Promise.all([
    supabase
      .from(TABLE)
      .select("item_id, user_id, shown_as")
      .eq("board_id", boardId),
    supabase
      .from("passport_board_members")
      .select("user_id")
      .eq("board_id", boardId),
  ]);

  if (interest.error) throw new InterestUnavailable(interest.error.message);
  if (members.error) throw new InterestUnavailable(members.error.message);

  const rows = (
    (interest.data as
      { item_id: string; user_id: string; shown_as: string | null }[] | null) ??
    []
  ).map((r) => ({ itemId: r.item_id, userId: r.user_id, shownAs: r.shown_as }));

  const memberIds = new Set(
    ((members.data as { user_id: string }[] | null) ?? []).map(
      (m) => m.user_id,
    ),
  );

  return { rows, memberIds };
}

/** Idempotent: saying it again replaces the name choice, never adds a row. */
export async function markInterest(
  user: PassportUser,
  boardId: string,
  itemId: string,
  shownAs: string | null,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from(TABLE).upsert(
    {
      board_id: boardId,
      item_id: itemId,
      user_id: user.id,
      shown_as: shownAs,
    },
    { onConflict: "board_id,item_id,user_id" },
  );
  if (error) throw new InterestUnavailable(error.message);
}

export async function clearInterest(
  user: PassportUser,
  boardId: string,
  itemId: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq("board_id", boardId)
    .eq("item_id", itemId)
    .eq("user_id", user.id);
  if (error) throw new InterestUnavailable(error.message);
}
