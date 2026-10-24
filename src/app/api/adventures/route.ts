import { NextResponse } from "next/server";
import {
  answer,
  badRequest,
  bodyOf,
  requireAdventureSession,
} from "@/lib/adventures/server";
import {
  addIdeas,
  adventuresOf,
  createAdventure,
  saveDay,
} from "@/lib/adventures/store";
import {
  parseHockeyFacts,
  parseIdeas,
  parseNewAdventure,
  parseSketch,
  type SketchRequest,
} from "@/lib/adventures/rules";
import { adventureKind } from "@/lib/adventures/kinds";
import { askFrom, daysBetween } from "@/lib/adventures/days";
import { AtlasUnavailable, sketchDays } from "@/lib/adventures/propose";

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
 * Saved things may come with it as its first ideas (`atlasRefs`).
 *
 * **Never a blank adventure** (ADR 012 §1): with `sketch` (`{ say, childAge }`),
 * a town and dates, each day is built by the Day Builder's own engine and
 * saved as Passport's suggestions. The adventure is created either way — a
 * sketch that cannot be made (Atlas down, no town, no dates) is reported in
 * `sketch`, never a failure to create.
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

  const sentIdeas = (body as { atlasRefs?: unknown }).atlasRefs;
  const ideas = sentIdeas === undefined ? null : parseIdeas(body);
  if (ideas && !ideas.ok) return badRequest(ideas.error);

  const sentSketch = (body as { sketch?: unknown }).sketch;
  let sketch: SketchRequest | null = null;
  if (sentSketch !== undefined && sentSketch !== null) {
    const read = parseSketch(sentSketch);
    if (!read.ok) return badRequest(read.error);
    sketch = read.value;
  }

  return answer(async () => {
    const id = await createAdventure(session.db, {
      ...parsed.value,
      displayName: session.user.displayName,
      hockey,
    });
    if (ideas?.ok) await addIdeas(session.db, id, session.user.id, ideas.value);
    if (!sketch) return NextResponse.json({ id }, { status: 201 });

    const days = daysBetween(parsed.value.startsOn, parsed.value.endsOn);
    const townId = parsed.value.destinationTownId;
    if (days.length === 0 || !townId)
      return NextResponse.json(
        { id, sketch: days.length === 0 ? "no-dates" : "no-town", sketched: 0 },
        { status: 201 },
      );
    let sketched = 0;
    try {
      const built = await sketchDays({
        days,
        townId,
        say: sketch.say,
        ...(sketch.childAge !== undefined ? { childAge: sketch.childAge } : {}),
        seeds: ideas?.ok ? ideas.value : [],
      });
      for (const day of built) {
        const ask = askFrom(day.query);
        if (!ask) continue;
        await saveDay(session.db, id, session.user.id, {
          onDay: day.onDay,
          ask,
          stops: day.stops,
          mode: "propose",
        });
        sketched += 1;
      }
    } catch (error) {
      if (!(error instanceof AtlasUnavailable)) throw error;
      return NextResponse.json(
        { id, sketch: "atlas-unavailable", sketched },
        { status: 201 },
      );
    }
    return NextResponse.json(
      { id, sketch: sketched > 0 ? "ok" : "nothing-fits", sketched },
      { status: 201 },
    );
  });
}
