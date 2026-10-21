import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { accessToBoard, removeMember } from "@/lib/collaboration/boardAccess";
import { CORE_EVENT_KINDS, recordEvent } from "@/lib/collaboration/events";
import { decideRemoval } from "@/lib/data/boards-membership";
import {
  LeaveUnavailable,
  leaveBoard,
} from "@/lib/data/boards-membership-server";

/**
 * Take somebody off a board — yourself, or, if you own it, anybody else.
 *
 * Leaving is any member's right and needs nobody's permission; removing
 * somebody else is the owner's alone, checked here and enforced again by
 * row-level security. An owner cannot remove themselves — a board with no
 * owner is a board nobody can ever share or delete again. See
 * `decideRemoval` for the whole table.
 *
 * `me` names the caller, so a browser can leave without ever being handed its
 * own user id.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ boardId: string; userId: string }> },
) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const { boardId, userId: asked } = await params;
  const userId = asked === "me" ? auth.user.id : asked;
  const access = await accessToBoard(auth.user, boardId);

  if (!access) {
    return NextResponse.json({ error: "Board not found." }, { status: 404 });
  }

  const decision = decideRemoval(
    { id: auth.user.id, role: access.role },
    access.ownerId,
    userId,
  );

  if (decision.kind === "refuse") {
    return NextResponse.json(
      { error: decision.error },
      { status: decision.status },
    );
  }

  if (decision.kind === "leave") {
    // Recorded *before* the row goes: `passport_events` only accepts writes
    // from a current owner or editor, so afterwards it would be refused in
    // silence. The event is only "go and re-read" — if the leave then fails,
    // everyone re-reads a board on which nothing changed. The leaver's name is
    // not in it: the member list everyone re-reads simply no longer has them.
    await recordEvent({
      resourceType: "board",
      resourceId: boardId,
      actorId: auth.user.id,
      kind: CORE_EVENT_KINDS.memberRemoved,
      payload: { left: true },
    });
    try {
      await leaveBoard(auth.user, boardId);
    } catch (error) {
      if (!(error instanceof LeaveUnavailable)) throw error;
      // Not "you've left" — they haven't, and everyone on the board can
      // still see them. Say so.
      return NextResponse.json(
        {
          error: "unavailable",
          message:
            "Passport can't take you off this board yet. Ask its owner to remove you.",
        },
        { status: 503 },
      );
    }
    return new NextResponse(null, { status: 204 });
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
