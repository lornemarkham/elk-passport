import { NextResponse } from "next/server";
import {
  badRequest,
  bodyOf,
  requireAdventureSession,
} from "@/lib/adventures/server";
import { parseNotice } from "@/domain/christmas/together";
import { announce, noticesOf } from "../../../_server/together";
import { together } from "../../../_server/http";

type Context = { params: Promise<{ id: string }> };

/** The group's announcements, newest first. Members only (RLS). */
export async function GET(_request: Request, { params }: Context) {
  const session = await requireAdventureSession();
  if ("response" in session) return session.response;
  const { id } = await params;
  return together(async () =>
    NextResponse.json(await noticesOf(session.db, id, session.user.id)),
  );
}

/** Announce something. The owner only — Postgres refuses anybody else. */
export async function POST(request: Request, { params }: Context) {
  const session = await requireAdventureSession();
  if ("response" in session) return session.response;
  const { id } = await params;
  const parsed = parseNotice(await bodyOf(request));
  if (!parsed.ok) return badRequest(parsed.error);
  return together(async () =>
    NextResponse.json(
      { id: await announce(session.db, id, session.user.id, parsed.value) },
      { status: 201 },
    ),
  );
}
