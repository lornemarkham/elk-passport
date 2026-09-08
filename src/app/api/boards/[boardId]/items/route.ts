import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { addBoardItemFor, listBoardItemsFor } from "@/lib/data/boards-server";
import { accessToBoard, canEdit } from "@/lib/collaboration/boardAccess";
import { CORE_EVENT_KINDS, recordEvent } from "@/lib/collaboration/events";

const notFound = () =>
  NextResponse.json({ error: "Board not found." }, { status: 404 });

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const { boardId } = await params;
  const access = await accessToBoard(auth.user, boardId);
  if (!access) return notFound();

  // Read on the *owner's* behalf: Atlas answers only for an owner and knows
  // nothing about sharing. Passport already decided this person may look.
  return NextResponse.json(await listBoardItemsFor(boardId, access.ownerId));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const { boardId } = await params;
  const body = await request.json().catch(() => null);
  const experienceId =
    typeof body?.experienceId === "string" ? body.experienceId.trim() : "";

  if (!experienceId) {
    return NextResponse.json(
      { error: "experienceId is required." },
      { status: 400 },
    );
  }

  const access = await accessToBoard(auth.user, boardId);
  if (!access) return notFound();

  if (!canEdit(access.role)) {
    return NextResponse.json(
      { error: "You can look at this board, but not change it." },
      { status: 403 },
    );
  }

  const item = await addBoardItemFor(boardId, experienceId, access.ownerId);

  // Written after the state changed, never instead of it. Whoever is watching
  // this board re-reads; the event is the nudge, not the truth.
  await recordEvent({
    resourceType: "board",
    resourceId: boardId,
    actorId: auth.user.id,
    kind: CORE_EVENT_KINDS.itemAdded,
    payload: { experienceId },
  });

  return NextResponse.json(item, { status: 201 });
}
