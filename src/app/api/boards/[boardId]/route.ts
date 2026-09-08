import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { deleteBoardFor, renameBoardFor } from "@/lib/data/boards-server";
import { accessToBoard, canShare } from "@/lib/collaboration/boardAccess";
import { CORE_EVENT_KINDS, recordEvent } from "@/lib/collaboration/events";

const notFound = () =>
  NextResponse.json({ error: "Board not found." }, { status: 404 });

const ownerOnly = () =>
  NextResponse.json(
    { error: "Only the board's owner can do that." },
    { status: 403 },
  );

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const { boardId } = await params;
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!name) {
    return NextResponse.json(
      { error: "A board needs a name." },
      { status: 400 },
    );
  }

  const access = await accessToBoard(auth.user, boardId);
  if (!access) return notFound();
  // Renaming a shared board changes what everyone else sees, so it stays with
  // the owner even though an editor may change its contents.
  if (!canShare(access.role)) return ownerOnly();

  const board = await renameBoardFor(boardId, name, access.ownerId);

  await recordEvent({
    resourceType: "board",
    resourceId: boardId,
    actorId: auth.user.id,
    kind: CORE_EVENT_KINDS.boardRenamed,
    payload: { name },
  });

  return NextResponse.json({ ...board, role: access.role });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const { boardId } = await params;
  const access = await accessToBoard(auth.user, boardId);
  if (!access) return notFound();
  if (!canShare(access.role)) return ownerOnly();

  await deleteBoardFor(boardId, access.ownerId);
  return new NextResponse(null, { status: 204 });
}
