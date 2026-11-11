import { NextResponse } from "next/server";
import {
  answer,
  badRequest,
  bodyOf,
  requireAdventureSession,
} from "@/lib/adventures/server";
import {
  addIdeas,
  addItem,
  createAdventure,
  saveDay,
} from "@/lib/adventures/store";
import { askFrom } from "@/lib/adventures/days";
import { AtlasUnavailable, sketchDays } from "@/lib/adventures/propose";
import { ATLAS_REF } from "@/lib/adventures/rules";
import { townById } from "@/domain/discovery/towns";
import { todayIn } from "@/lib/adventures/overview";
import type { Party } from "@/domain/christmas/discover";
import { daysOf, place, sayFor, shapeById } from "@/domain/christmas/plans";
import { KIND_LABEL } from "@/domain/christmas/lights/model";
import { christmasFinds } from "../../_server/corpus";
import { lightsFor, viewer } from "../../_server/lights";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const PIN_ID = /^(seed|pin)-[a-z0-9-]{1,80}$/;
const PARTIES: readonly Party[] = ["family", "friends", "couple", "solo"];

/**
 * **Start a Christmas adventure** — an adventure of kind `christmas` on the
 * one group core, sketched by the Day Builder's own engine. The same steps as
 * `POST /api/adventures` (create → ideas → sketch → save each day as
 * Passport's suggestions), with one Christmas difference: a chosen event
 * Atlas dates to one day of the plan goes on that day (`place`), and one
 * Atlas dates outside the plan stays an idea and is reported, never moved.
 */
export async function POST(request: Request) {
  const session = await requireAdventureSession();
  if ("response" in session) return session.response;
  const { db, user } = session;

  const body = (await bodyOf(request)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return badRequest("Nothing was sent.");
  const shape = shapeById(
    typeof body.shape === "string" ? body.shape : undefined,
  );
  const title =
    typeof body.title === "string" && body.title.trim()
      ? body.title.trim().slice(0, 120)
      : shape.title;
  const startsOn =
    typeof body.startsOn === "string" && DAY.test(body.startsOn)
      ? body.startsOn
      : null;
  const count = Math.max(
    1,
    Math.min(
      5,
      Number.isInteger(body.days) ? (body.days as number) : shape.days,
    ),
  );
  const town = townById(
    typeof body.townId === "string" ? body.townId : undefined,
  );
  const refs = Array.isArray(body.atlasRefs)
    ? [
        ...new Set(
          body.atlasRefs.filter(
            (r): r is string => typeof r === "string" && ATLAS_REF.test(r),
          ),
        ),
      ].slice(0, 12)
    : [];
  // Light displays chosen on the lights map or the front page. Ids only: what
  // goes into the adventure is read here, from displays this person may see
  // published (`lightsFor`), never from anything the browser sent.
  const lightIds = Array.isArray(body.lights)
    ? [
        ...new Set(
          body.lights.filter(
            (r): r is string => typeof r === "string" && PIN_ID.test(r),
          ),
        ),
      ].slice(0, 12)
    : [];
  const party = PARTIES.find((p) => p === body.party);
  const youngest =
    Number.isInteger(body.youngest) &&
    (body.youngest as number) >= 0 &&
    (body.youngest as number) <= 17
      ? (body.youngest as number)
      : undefined;
  const extra =
    typeof body.extra === "string" ? body.extra.trim().slice(0, 200) : "";
  const sketch = body.sketch !== false;
  if (startsOn && startsOn < todayIn())
    return badRequest("Pick a day that hasn't happened yet.");

  const days = startsOn ? daysOf(startsOn, count) : [];

  /** The chosen light displays, as items on the first day (after dark, last). */
  async function addLights(adventureId: string): Promise<number> {
    if (lightIds.length === 0) return 0;
    const { pins } = await lightsFor(await viewer());
    const byId = new Map(
      pins.filter((p) => p.status === "approved").map((p) => [p.id, p]),
    );
    let added = 0;
    for (const lightId of lightIds) {
      const pin = byId.get(lightId);
      if (!pin) continue;
      await addItem(db, adventureId, user.id, {
        atlasRef: null,
        label: pin.name.slice(0, 120),
        note: [
          KIND_LABEL[pin.kind],
          pin.address ?? null,
          pin.hours ? `Viewing: ${pin.hours}` : null,
          `Map: /christmas/lights/${pin.id}`,
        ]
          .filter(Boolean)
          .join(" · ")
          .slice(0, 1000),
        status: "confirmed",
        onDay: days[0] ?? null,
        startsAt: null,
      });
      added += 1;
    }
    return added;
  }

  return answer(async () => {
    const id = await createAdventure(session.db, {
      kind: "christmas",
      title,
      startsOn,
      endsOn: days.length > 1 ? days.at(-1)! : null,
      timeZone: null,
      destinationLabel: town?.name.replace(/,\s*BC$/, "") ?? null,
      destinationTownId: town?.id ?? null,
      displayName: session.user.displayName,
    });
    if (refs.length) await addIdeas(session.db, id, session.user.id, refs);
    if (!sketch) {
      const lights = await addLights(id);
      return NextResponse.json({ id, lights }, { status: 201 });
    }
    if (days.length === 0 || !town) {
      const lights = await addLights(id);
      return NextResponse.json(
        { id, lights, sketch: days.length === 0 ? "no-dates" : "no-town" },
        { status: 201 },
      );
    }

    // Atlas's dates for what was chosen, read the way Discovery reads them.
    const { finds } = await christmasFinds({ km: 50, ages: [] }, todayIn());
    const byId = new Map(finds.map((f) => [f.experience.id, f]));
    const placement = place(
      refs.flatMap((r) => {
        const f = byId.get(r);
        return f ? [{ id: r, when: f.when }] : [];
      }),
      days,
    );
    const seeds = refs.filter((r) => !placement.offDates.includes(r));
    let sketched = 0;
    try {
      const built = await sketchDays({
        days,
        townId: town.id,
        say: sayFor({
          shape,
          ...(party ? { party } : {}),
          ...(youngest !== undefined ? { youngest } : {}),
          extra,
        }),
        ...(youngest !== undefined ? { childAge: youngest } : {}),
        seeds,
        pinned: placement.pinned,
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
      const lights = await addLights(id);
      return NextResponse.json(
        { id, lights, sketch: "atlas-unavailable", sketched },
        { status: 201 },
      );
    }
    const lights = await addLights(id);
    return NextResponse.json(
      {
        id,
        lights,
        sketch: sketched > 0 ? "ok" : "nothing-fits",
        sketched,
        offDates: placement.offDates.length,
      },
      { status: 201 },
    );
  });
}
