import { z } from "zod";
import { asMember } from "../../../../../_server/respond";
import { NightError, removeMember } from "../../../../../_server/night";

export const dynamic = "force-dynamic";

/**
 * The host removes a guest, or a guest leaves. Who may do which is decided by
 * the database (`passport_occasion_members_remove`), not here.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const { id, userId } = await params;
  return asMember(async (user) => {
    if (!z.string().uuid().safeParse(userId).success) {
      throw new NightError("Not found.", 404);
    }
    await removeMember(user, id, userId);
  });
}
