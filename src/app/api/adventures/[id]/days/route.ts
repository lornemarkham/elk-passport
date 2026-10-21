import { NextResponse } from "next/server";
import {
  answer,
  badRequest,
  bodyOf,
  requireAdventureSession,
} from "@/lib/adventures/server";
import { addIdeas, Refused, roleIn, saveDay } from "@/lib/adventures/store";
import { askFrom, stopsFrom } from "@/lib/adventures/days";

type Params = { params: Promise<{ id: string }> };

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * **A day Go Have a Day built, brought back to the adventure.**
 *
 * `{ query }` is the day query `/go` writes (stops, sentence, town, day…).
 * The owner's day is saved: its stops take that day and that order, and the
 * sentence is kept so the day can be refined later. Anybody else in the
 * adventure suggests it instead — its stops arrive as ideas for the owner —
 * because placing stops on a day is the owner's to do (RLS).
 */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const session = await requireAdventureSession();
  if ("response" in session) return session.response;

  const query = (await bodyOf(request)) as { query?: unknown } | null;
  if (typeof query?.query !== "string" || query.query.length > 4000)
    return badRequest("That isn't a day.");
  const stops = stopsFrom(query.query);
  const ask = askFrom(query.query);
  const onDay = new URLSearchParams(query.query).get("on") ?? "";
  if (!stops || !ask || !DAY.test(onDay))
    return badRequest("That day has no stops, sentence or date to keep.");

  return answer(async () => {
    const role = await roleIn(session.db, id);
    if (!role) throw new Refused();
    if (role === "owner") {
      await saveDay(session.db, id, session.user.id, { onDay, ask, stops });
      return NextResponse.json({ saved: "day", onDay });
    }
    const added = await addIdeas(session.db, id, session.user.id, stops);
    return NextResponse.json({ saved: "suggested", added });
  });
}
