import { NextResponse } from "next/server";
import {
  badRequest,
  bodyOf,
  requireAdventureSession,
} from "@/lib/adventures/server";
import { acknowledge, endNotice } from "../../../../_server/together";
import { together } from "../../../../_server/http";

type Context = { params: Promise<{ id: string; noticeId: string }> };

/** `{ action: "ack" }` — Got it (anyone in it). `{ action: "end" }` — the owner ends it. */
export async function POST(request: Request, { params }: Context) {
  const session = await requireAdventureSession();
  if ("response" in session) return session.response;
  const { id, noticeId } = await params;
  const body = (await bodyOf(request)) as { action?: unknown } | null;
  const action = body?.action;
  if (action !== "ack" && action !== "end")
    return badRequest("Say ack or end.");
  return together(async () => {
    if (action === "ack")
      await acknowledge(session.db, id, noticeId, session.user.id);
    else await endNotice(session.db, id, noticeId);
    return NextResponse.json({ ok: true });
  });
}
