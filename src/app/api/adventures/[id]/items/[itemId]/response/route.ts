import { NextResponse } from "next/server";
import {
  answer,
  badRequest,
  bodyOf,
  requireAdventureSession,
} from "@/lib/adventures/server";
import { respond } from "@/lib/adventures/store";
import { parseResponse } from "@/lib/adventures/rules";

type Params = { params: Promise<{ id: string; itemId: string }> };

/** `{ response: "in" | "maybe" | "out" | null }` — your own answer only. */
export async function PUT(request: Request, { params }: Params) {
  const { id, itemId } = await params;
  const session = await requireAdventureSession();
  if ("response" in session) return session.response;
  const parsed = parseResponse(await bodyOf(request));
  if (!parsed.ok) return badRequest(parsed.error);
  return answer(async () => {
    await respond(session.db, id, itemId, session.user.id, parsed.value);
    return new NextResponse(null, { status: 204 });
  });
}
