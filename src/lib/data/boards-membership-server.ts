import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PassportUser } from "@/lib/auth/currentUser";

/**
 * **Leaving a board, through your own session.**
 *
 * The delete runs as the person leaving, so row-level security decides — and
 * today it decides *no*: `passport_board_members` only lets an owner delete
 * rows. The policy that lets a member delete their own non-owner row is
 * proposed in `docs/product/shared-adventures.md` rather than migrated here,
 * because migrations belong to the contracts lane.
 *
 * Until it lands, Postgres refuses silently — zero rows, no error — and a
 * route that trusted "no error" would tell somebody *you've left* while they
 * were still on the board, still counted, still visible to everyone on it.
 * So the delete asks for the rows it removed, and none is `LeaveUnavailable`.
 */
export class LeaveUnavailable extends Error {
  constructor(cause: string) {
    super(`Leaving is unavailable: ${cause}`);
    this.name = "LeaveUnavailable";
  }
}

export async function leaveBoard(
  user: PassportUser,
  boardId: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("passport_board_members")
    .delete()
    .eq("board_id", boardId)
    .eq("user_id", user.id)
    .neq("role", "owner")
    .select("user_id");

  if (error) throw new LeaveUnavailable(error.message);
  if (!data || data.length === 0) {
    throw new LeaveUnavailable("the membership row was not removed");
  }

  // Your raised hands go with you. They already stopped counting the moment
  // the row above went (interest counts members only), but the name you chose
  // to show was still stored on them. Best effort: the proposed trigger does
  // the same for somebody an owner removes, and a failure here must not turn
  // a completed leave into an error.
  await supabase
    .from("passport_board_interest")
    .delete()
    .eq("board_id", boardId)
    .eq("user_id", user.id)
    .then(
      () => undefined,
      () => undefined,
    );
}
