import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { removeBoardItemFor } from "@/lib/data/boards-server";
import { accessToBoard, canEdit } from "@/lib/collaboration/boardAccess";
import { CORE_EVENT_KINDS, recordEvent } from "@/lib/collaboration/events";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ boardId: string; experienceId: string }> },
) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const { boardId, experienceId } = await params;
  const access = await accessToBoard(auth.user, boardId);

  if (!access) {
    return NextResponse.json({ error: "Board not found." }, { status: 404 });
  }
  if (!canEdit(access.role)) {
    return NextResponse.json(
      { error: "You can look at this board, but not change it." },
      { status: 403 },
    );
  }

  await removeBoardItemFor(boardId, experienceId, access.ownerId);

  await recordEvent({
    resourceType: "board",
    resourceId: boardId,
    actorId: auth.user.id,
    kind: CORE_EVENT_KINDS.itemRemoved,
    payload: { experienceId },
  });

  return new NextResponse(null, { status: 204 });
}
