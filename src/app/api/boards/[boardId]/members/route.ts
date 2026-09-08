import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { accessToBoard, membersOf } from "@/lib/collaboration/boardAccess";

/** Who is on this board. Members only — the list is not public to a link. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const { boardId } = await params;
  const access = await accessToBoard(auth.user, boardId);
  if (!access) {
    return NextResponse.json({ error: "Board not found." }, { status: 404 });
  }

  return NextResponse.json({
    role: access.role,
    members: await membersOf(auth.user, boardId),
  });
}
