import { NextResponse } from "next/server";
import {
  answer,
  badRequest,
  bodyOf,
  requireAdventureSession,
} from "@/lib/adventures/server";
import { setHockeyFacts } from "@/lib/adventures/store";
import { parseHockeyFacts } from "@/lib/adventures/rules";

type Params = { params: Promise<{ id: string }> };

/**
 * The hockey extension: the game's facts for a Hockey Night. Owner only, and
 * only on a `hockey-night` — Postgres refuses any other kind.
 */
export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const session = await requireAdventureSession();
  if ("response" in session) return session.response;
  const parsed = parseHockeyFacts(await bodyOf(request));
  if (!parsed.ok) return badRequest(parsed.error);
  return answer(async () => {
    await setHockeyFacts(session.db, id, parsed.value);
    return new NextResponse(null, { status: 204 });
  });
}
