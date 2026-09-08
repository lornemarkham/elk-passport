import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import {
  addBoardItemFor,
  BoardNotFound,
  listBoardItemsFor,
} from "@/lib/data/boards-server";

const notFound = () =>
  NextResponse.json({ error: "Board not found." }, { status: 404 });

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const { boardId } = await params;

  try {
    return NextResponse.json(await listBoardItemsFor(boardId, auth.user.id));
  } catch (error) {
    if (error instanceof BoardNotFound) return notFound();
    throw error;
  }
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

  try {
    const item = await addBoardItemFor(boardId, experienceId, auth.user.id);
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    if (error instanceof BoardNotFound) return notFound();
    throw error;
  }
}
