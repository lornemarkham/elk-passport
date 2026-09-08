import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import {
  BoardNotFound,
  deleteBoardFor,
  renameBoardFor,
} from "@/lib/data/boards-server";

const notFound = () =>
  NextResponse.json({ error: "Board not found." }, { status: 404 });

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

  try {
    return NextResponse.json(await renameBoardFor(boardId, name, auth.user.id));
  } catch (error) {
    if (error instanceof BoardNotFound) return notFound();
    throw error;
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const { boardId } = await params;

  try {
    await deleteBoardFor(boardId, auth.user.id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof BoardNotFound) return notFound();
    throw error;
  }
}
