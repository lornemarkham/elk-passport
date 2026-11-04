import { NextResponse } from "next/server";
import {
  answer,
  badRequest,
  bodyOf,
  requireAdventureSession,
} from "@/lib/adventures/server";
import { parseAction } from "@/domain/snow/shared";
import { act, loadDay } from "../../_server/shared";

const ID = /^[a-f0-9]{32}$/;
type Ctx = { params: Promise<{ id: string }> };

/** The day as the signed-in caller sees it. Phones poll this. */
export async function GET(_request: Request, { params }: Ctx) {
  const { id } = await params;
  if (!ID.test(id))
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  const session = await requireAdventureSession();
  if ("response" in session) return session.response;
  return answer(async () => {
    const view = await loadDay(session.db, id, session.user.id);
    return NextResponse.json(view, {
      headers: { "Cache-Control": "no-store" },
    });
  });
}

/**
 * One change: `{ action }`, the same `Action` the screen runs. 422 with a
 * sentence when it does not make sense or is not this person's to make.
 */
export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  if (!ID.test(id))
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  const session = await requireAdventureSession();
  if ("response" in session) return session.response;

  const body = (await bodyOf(request)) as { action?: unknown } | null;
  const action = parseAction(body?.action);
  if (!action) return badRequest("That change wasn't understood.");

  return answer(async () => {
    const outcome = await act(session.db, id, session.user.id, action);
    if (!outcome.ok)
      return NextResponse.json({ error: outcome.reason }, { status: 422 });
    return NextResponse.json(outcome.view ?? { left: true }, {
      headers: { "Cache-Control": "no-store" },
    });
  });
}
