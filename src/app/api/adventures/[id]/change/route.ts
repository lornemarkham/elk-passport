import { NextResponse } from "next/server";
import {
  answer,
  badRequest,
  bodyOf,
  requireAdventureSession,
} from "@/lib/adventures/server";
import { adventureFor, Refused } from "@/lib/adventures/store";
import { parseSaid } from "@/lib/adventures/rules";
import { AtlasUnavailable, previewChange } from "@/lib/adventures/propose";
import { ZONE } from "@/domain/experience/eventTime";

type Params = { params: Promise<{ id: string }> };

/**
 * **"Make Saturday more adventurous" — what would change.** Reads the
 * sentence against the adventure as the signed-in person may see it, and
 * answers before → after for each day it touches. Writes nothing: applying
 * is `POST …/days` (`mode: "propose"`) or `POST …/swap`, which the database
 * allows only the owner (ADR 012 §3).
 */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const session = await requireAdventureSession();
  if ("response" in session) return session.response;
  const said = parseSaid(await bodyOf(request));
  if (!said.ok) return badRequest(said.error);

  return answer(async () => {
    const view = await adventureFor(session.db, id, session.user.id);
    if (!view) throw new Refused();
    const today = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: view.timeZone ?? ZONE,
    }).format(new Date());
    try {
      return NextResponse.json(await previewChange(view, said.value, today));
    } catch (error) {
      if (error instanceof AtlasUnavailable)
        return NextResponse.json(
          {
            kind: "none",
            reply:
              "Atlas can't be reached right now, so Passport can't suggest changes. Everything on the plan can still be changed by hand.",
          },
          { status: 503 },
        );
      throw error;
    }
  });
}
