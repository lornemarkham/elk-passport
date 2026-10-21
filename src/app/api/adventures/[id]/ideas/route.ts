import { NextResponse } from "next/server";
import {
  answer,
  badRequest,
  bodyOf,
  requireAdventureSession,
} from "@/lib/adventures/server";
import { addIdeas } from "@/lib/adventures/store";
import { parseIdeas } from "@/lib/adventures/rules";

type Params = { params: Promise<{ id: string }> };

/**
 * Saved things onto an adventure, as ideas not on a day yet:
 * `{ atlasRefs: [...] }`. Any member may; Postgres decides who is one.
 * Answers how many were new — adding something twice adds it once.
 */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const session = await requireAdventureSession();
  if ("response" in session) return session.response;
  const parsed = parseIdeas(await bodyOf(request));
  if (!parsed.ok) return badRequest(parsed.error);
  return answer(async () => {
    const added = await addIdeas(session.db, id, session.user.id, parsed.value);
    return NextResponse.json({ added }, { status: 201 });
  });
}
