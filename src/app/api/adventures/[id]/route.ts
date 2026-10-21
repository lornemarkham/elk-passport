import { NextResponse } from "next/server";
import {
  answer,
  badRequest,
  bodyOf,
  requireAdventureSession,
} from "@/lib/adventures/server";
import {
  adventureFor,
  deleteAdventure,
  Refused,
  updateAdventure,
} from "@/lib/adventures/store";
import { parseAdventurePatch } from "@/lib/adventures/rules";

type Params = { params: Promise<{ id: string }> };

/** The adventure as this person may see it. 404 for missing and not-yours alike. */
export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const session = await requireAdventureSession();
  if ("response" in session) return session.response;
  return answer(async () => {
    const view = await adventureFor(session.db, id, session.user.id);
    if (!view) throw new Refused();
    return NextResponse.json(view);
  });
}

/** Owner only — Postgres says so, not this handler. */
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const session = await requireAdventureSession();
  if ("response" in session) return session.response;
  const parsed = parseAdventurePatch(await bodyOf(request));
  if (!parsed.ok) return badRequest(parsed.error);
  return answer(async () => {
    await updateAdventure(session.db, id, parsed.value);
    return new NextResponse(null, { status: 204 });
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const session = await requireAdventureSession();
  if ("response" in session) return session.response;
  return answer(async () => {
    await deleteAdventure(session.db, id);
    return new NextResponse(null, { status: 204 });
  });
}
