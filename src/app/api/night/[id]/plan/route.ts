import { NextResponse } from "next/server";
import {
  answer,
  badRequest,
  bodyOf,
  requireAdventureSession,
} from "@/lib/adventures/server";
import { adventureFor, Refused } from "@/lib/adventures/store";
import { nightForTitle } from "@/domain/date-night/adventures";
import { parsePlan, savePlan } from "@/lib/date-night/plan";

type Params = { params: Promise<{ id: string }> };

/**
 * **`PUT` the night's itinerary** — the one list every planning action on
 * `/night/[id]` writes: choosing an adventure, the other ending, a sentence
 * applied, Change · Move · Remove · Add. The owner's (RLS); the other person
 * adds their own stops through the core's `POST …/items`.
 */
export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const session = await requireAdventureSession();
  if ("response" in session) return session.response;
  const plan = parsePlan(await bodyOf(request));
  if (typeof plan === "string") return badRequest(plan);
  return answer(async () => {
    const view = await adventureFor(session.db, id, session.user.id);
    const day = view ? nightForTitle(view.title)?.day : undefined;
    if (!view || !day) throw new Refused();
    await savePlan(session.db, id, session.user.id, day, plan);
    return new NextResponse(null, { status: 204 });
  });
}
