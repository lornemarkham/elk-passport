import { NextResponse } from "next/server";
import {
  badRequest,
  bodyOf,
  requireAdventureSession,
} from "@/lib/adventures/server";
import {
  addPacking,
  packingOf,
  parsePackingLabel,
} from "@/lib/date-night/night";
import { night } from "../../_http";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const session = await requireAdventureSession();
  if ("response" in session) return session.response;
  return night(async () => NextResponse.json(await packingOf(session.db, id)));
}

/** `{ label }` — add something to bring. */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const session = await requireAdventureSession();
  if ("response" in session) return session.response;
  const label = parsePackingLabel(await bodyOf(request));
  if (!label)
    return badRequest("Say what to bring, in 80 characters or fewer.");
  return night(async () =>
    NextResponse.json(
      { id: await addPacking(session.db, id, session.user.id, label) },
      { status: 201 },
    ),
  );
}
