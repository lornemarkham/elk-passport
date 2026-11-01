import { NextResponse } from "next/server";
import { requireAdventureSession } from "@/lib/adventures/server";
import { unshare } from "../../../../_server/together";
import { together } from "../../../../_server/http";

type Context = { params: Promise<{ id: string; momentId: string }> };

/** Take something back. Yours, or anything if it's your adventure (RLS). */
export async function DELETE(_request: Request, { params }: Context) {
  const session = await requireAdventureSession();
  if ("response" in session) return session.response;
  const { id, momentId } = await params;
  return together(async () => {
    await unshare(session.db, id, momentId);
    return NextResponse.json({ ok: true });
  });
}
