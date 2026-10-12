import { NextResponse } from "next/server";
import {
  answer,
  badRequest,
  bodyOf,
  requireAdventureSession,
} from "@/lib/adventures/server";
import { removeItem, updateItem } from "@/lib/adventures/store";
import { parseItemPatch } from "@/lib/adventures/rules";

type Params = { params: Promise<{ id: string; itemId: string }> };

/** The owner changes anything (confirming included); a proposer their own proposal. */
export async function PATCH(request: Request, { params }: Params) {
  const { id, itemId } = await params;
  const session = await requireAdventureSession();
  if ("response" in session) return session.response;
  const parsed = parseItemPatch(await bodyOf(request));
  if (!parsed.ok) return badRequest(parsed.error);
  return answer(async () => {
    await updateItem(session.db, id, itemId, parsed.value);
    return new NextResponse(null, { status: 204 });
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id, itemId } = await params;
  const session = await requireAdventureSession();
  if ("response" in session) return session.response;
  return answer(async () => {
    await removeItem(session.db, id, itemId);
    return new NextResponse(null, { status: 204 });
  });
}
