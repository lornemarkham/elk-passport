import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import {
  accessToBoard,
  canShare,
  removeMember,
} from "@/lib/collaboration/boardAccess";
import { CORE_EVENT_KINDS, recordEvent } from "@/lib/collaboration/events";

/**
 * Remove somebody from a board.
 *
 * Owners only, checked here and enforced again by row-level security, so a
 * mistake in this handler cannot become a way for an editor to evict people.
 * An owner cannot remove themselves — a board with no owner is a board nobody
 * can ever share or delete again.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ boardId: string; userId: string }> },
) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const { boardId, userId } = await params;
  const access = await accessToBoard(auth.user, boardId);

  if (!access) {
    return NextResponse.json({ error: "Board not found." }, { status: 404 });
  }
  if (!canShare(access.role)) {
    return NextResponse.json(
      { error: "Only the board's owner can change who is on it." },
      { status: 403 },
    );
  }
  if (userId === access.ownerId) {
    return NextResponse.json(
      { error: "A board keeps its owner." },
      { status: 400 },
    );
  }

  await removeMember(boardId, userId);
  await recordEvent({
    resourceType: "board",
    resourceId: boardId,
    actorId: auth.user.id,
    kind: CORE_EVENT_KINDS.memberRemoved,
    payload: { userId },
  });

  return new NextResponse(null, { status: 204 });
}
