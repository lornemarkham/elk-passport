import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { createBoardFor } from "@/lib/data/boards-server";
import {
  boardsVisibleTo,
  ensureOwnerMembership,
} from "@/lib/collaboration/boardAccess";

/**
 * Every board this person can reach — the ones they made, and the ones shared
 * with them — each carrying the role they hold on it.
 *
 * `ownerId` is never read from the request. It comes from the verified session
 * and nowhere else, so there is no request a browser can send that reaches
 * somebody else's boards.
 */
export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const access = await boardsVisibleTo(auth.user);

  return NextResponse.json(
    access.map(({ board, role }) => ({ ...board, role })),
  );
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

  // Recorded now so the board can be shared later. Atlas remains the authority
  // on who owns it; this row only ever lets Passport add other people.
  await ensureOwnerMembership(auth.user, board.id);

  return NextResponse.json({ ...board, role: "owner" }, { status: 201 });
}
