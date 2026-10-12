import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Write the row that says `userId` owns `boardId`, as `userId`.
 *
 * A plain insert, not an upsert. For `INSERT … ON CONFLICT DO UPDATE` Postgres
 * also applies the SELECT policy to the new row, and
 * `passport_is_board_member` cannot see a row that is not written yet, so an
 * upsert is refused for every board that has no rows: the first share of
 * every board. An existing row (23505) means it is already done.
 *
 * Takes the caller's client so the stack suite runs this exact write against
 * real RLS. Returns whether the row exists afterwards.
 */
export async function writeOwnerRow(
  supabase: SupabaseClient,
  boardId: string,
  userId: string,
): Promise<boolean> {
  const { error } = await supabase.from("passport_board_members").insert({
    board_id: boardId,
    board_owner_id: userId,
    user_id: userId,
    role: "owner",
  });
  return !error || error.code === "23505";
}
