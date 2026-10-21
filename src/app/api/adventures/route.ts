import { NextResponse } from "next/server";
import {
  answer,
  badRequest,
  bodyOf,
  requireAdventureSession,
} from "@/lib/adventures/server";
import { adventuresOf, createAdventure } from "@/lib/adventures/store";
import { parseHockeyFacts, parseNewAdventure } from "@/lib/adventures/rules";
import { adventureKind } from "@/lib/adventures/kinds";

/** Every adventure the signed-in person is in, made or joined. */
export async function GET() {
  const session = await requireAdventureSession();
  if ("response" in session) return session.response;
  return answer(async () =>
    NextResponse.json(await adventuresOf(session.db, session.user.id)),
  );
}

/**
 * Start one. The kind must be declared in code; the caller becomes owner.
 * A kind with a typed extension may send its facts alongside (`hockey`).
 */
export async function POST(request: Request) {
  const session = await requireAdventureSession();
  if ("response" in session) return session.response;

  const body = await bodyOf(request);
  const parsed = parseNewAdventure(body);
  if (!parsed.ok) return badRequest(parsed.error);

  let hockey = null;
  const sentHockey = (body as { hockey?: unknown }).hockey;
  if (sentHockey !== undefined && sentHockey !== null) {
    if (adventureKind(parsed.value.kind)?.extension !== "hockey") {
      return badRequest("Only a Hockey Night has game details.");
    }
    const facts = parseHockeyFacts(sentHockey);
    if (!facts.ok) return badRequest(facts.error);
    hockey = facts.value;
  }

  return answer(async () => {
    const id = await createAdventure(session.db, {
      ...parsed.value,
      displayName: session.user.displayName,
      hockey,
    });
    return NextResponse.json({ id }, { status: 201 });
  });
}
