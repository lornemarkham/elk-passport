import { NextResponse } from "next/server";
import {
  answer,
  badRequest,
  bodyOf,
  requireAdventureSession,
} from "@/lib/adventures/server";
import { addItem } from "@/lib/adventures/store";
import { parseItem } from "@/lib/adventures/rules";

type Params = { params: Promise<{ id: string }> };

/**
 * Put something on the group's plan: an Atlas thing (`atlasRef`), a place in
 * the group's words (`label`), or a note. Any member proposes; only the owner
 * may add something already `confirmed` (Postgres enforces it).
 */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const session = await requireAdventureSession();
  if ("response" in session) return session.response;
  const parsed = parseItem(await bodyOf(request));
  if (!parsed.ok) return badRequest(parsed.error);
  return answer(async () => {
    const itemId = await addItem(session.db, id, session.user.id, parsed.value);
    return NextResponse.json({ id: itemId }, { status: 201 });
  });
}
