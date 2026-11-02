import { NextResponse } from "next/server";
import {
  badRequest,
  bodyOf,
  requireAdventureSession,
} from "@/lib/adventures/server";
import { removePacking, tickPacking } from "@/lib/date-night/night";
import { night } from "../../../_http";

type Params = { params: Promise<{ id: string; itemId: string }> };

/** `{ checked: boolean }` — tick or untick; either of you may. */
export async function PATCH(request: Request, { params }: Params) {
  const { id, itemId } = await params;
  const session = await requireAdventureSession();
  if ("response" in session) return session.response;
  const body = (await bodyOf(request)) as { checked?: unknown } | null;
  if (typeof body?.checked !== "boolean") return badRequest("Ticked or not?");
  const checked = body.checked;
  return night(async () => {
    await tickPacking(session.db, id, itemId, session.user.id, checked);
    return new NextResponse(null, { status: 204 });
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id, itemId } = await params;
  const session = await requireAdventureSession();
  if ("response" in session) return session.response;
  return night(async () => {
    await removePacking(session.db, id, itemId);
    return new NextResponse(null, { status: 204 });
  });
}
