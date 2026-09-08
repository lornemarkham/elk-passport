import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { createBoardFor, listBoardsFor } from "@/lib/data/boards-server";

/**
 * The signed-in person's boards.
 *
 * `ownerId` is never read from the request. It comes from the verified session
 * and nowhere else, so there is no shape of request a browser can send that
 * reaches another person's boards.
 */
export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  return NextResponse.json(await listBoardsFor(auth.user.id));
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!name) {
    return NextResponse.json(
      { error: "A board needs a name." },
      { status: 400 },
    );
  }

  const board = await createBoardFor(name, auth.user.id);
  return NextResponse.json(board, { status: 201 });
}
