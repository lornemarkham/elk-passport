import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { BoardNotFound, removeBoardItemFor } from "@/lib/data/boards-server";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ boardId: string; experienceId: string }> },
) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const { boardId, experienceId } = await params;

  try {
    await removeBoardItemFor(boardId, experienceId, auth.user.id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof BoardNotFound) {
      return NextResponse.json({ error: "Board not found." }, { status: 404 });
    }
    throw error;
  }
}
