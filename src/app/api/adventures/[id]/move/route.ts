import { NextResponse } from "next/server";
import {
  answer,
  badRequest,
  bodyOf,
  requireAdventureSession,
} from "@/lib/adventures/server";
import { adventureFor, Refused, updateItem } from "@/lib/adventures/store";
import { moveWithin } from "@/lib/adventures/days";

type Params = { params: Promise<{ id: string }> };

/**
 * **Move one stop earlier or later within its day** (or one idea within the
 * ideas). The server works out every position that changes (`moveWithin`),
 * so the browser sends one request, not one per neighbour. The database
 * decides whether the caller may (RLS: the owner).
 */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const session = await requireAdventureSession();
  if ("response" in session) return session.response;
  const body = (await bodyOf(request)) as {
    item?: unknown;
    direction?: unknown;
  } | null;
  const itemId = typeof body?.item === "string" ? body.item : "";
  const direction =
    body?.direction === -1 || body?.direction === 1 ? body.direction : 0;
  if (!itemId || direction === 0)
    return badRequest("Say what to move, and which way.");

  return answer(async () => {
    const view = await adventureFor(session.db, id, session.user.id);
    const item = view?.items.find((i) => i.id === itemId);
    if (!view || !item) throw new Refused();
    const group = view.items.filter((i) => i.onDay === item.onDay);
    const writes = moveWithin(group, itemId, direction) ?? [];
    for (const w of writes)
      await updateItem(session.db, id, w.id, { position: w.position });
    return NextResponse.json({ moved: writes.length });
  });
}
