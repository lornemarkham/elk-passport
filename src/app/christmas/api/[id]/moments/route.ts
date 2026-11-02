import { NextResponse } from "next/server";
import {
  badRequest,
  bodyOf,
  requireAdventureSession,
} from "@/lib/adventures/server";
import { parseMoment } from "@/domain/christmas/together";
import { momentsOf, share } from "../../../_server/together";
import { together } from "../../../_server/http";

type Context = { params: Promise<{ id: string }> };

/** What the group has shared, oldest first, without the photo bytes. */
export async function GET(_request: Request, { params }: Context) {
  const session = await requireAdventureSession();
  if ("response" in session) return session.response;
  const { id } = await params;
  return together(async () =>
    NextResponse.json(await momentsOf(session.db, id, session.user.id)),
  );
}

/** Share a photo, a moment, a tradition or a finished challenge. */
export async function POST(request: Request, { params }: Context) {
  const session = await requireAdventureSession();
  if ("response" in session) return session.response;
  const { id } = await params;
  const parsed = parseMoment(await bodyOf(request));
  if (!parsed.ok) return badRequest(parsed.error);
  return together(async () =>
    NextResponse.json(
      { id: await share(session.db, id, session.user.id, parsed.value) },
      { status: 201 },
    ),
  );
}
