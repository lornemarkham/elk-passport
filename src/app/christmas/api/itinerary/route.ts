import { NextResponse } from "next/server";
import {
  answer,
  badRequest,
  bodyOf,
  requireAdventureSession,
} from "@/lib/adventures/server";
import { addItem, createAdventure } from "@/lib/adventures/store";
import { stopInstant } from "@/domain/christmas/itinerary";
import { clockText } from "@/domain/christmas/edits";
import { planFor } from "../../_server/itinerary";

/**
 * **Share a Christmas plan with your people** — the itinerary becomes an
 * adventure of kind `christmas` on Passport's one group core (ADR 009), so
 * invitations, in / maybe / out, announcements, challenges, memories and the
 * recap are the ones that already exist. The plan is recomputed here from
 * the address the browser sends (the sentence and its edits), so what is
 * saved is what Atlas and the lights map support — never places the browser
 * named. Unresolved parts go in as a note, so the group sees what is still
 * open rather than losing it.
 */
export async function POST(request: Request) {
  const session = await requireAdventureSession();
  if ("response" in session) return session.response;
  const { db, user } = session;
  const body = (await bodyOf(request)) as { query?: unknown } | null;
  const query =
    body && typeof body.query === "object" && body.query
      ? Object.fromEntries(
          Object.entries(body.query as Record<string, unknown>).flatMap(
            ([k, v]) => (typeof v === "string" ? [[k, v.slice(0, 600)]] : []),
          ),
        )
      : null;
  if (!query) return badRequest("Nothing was sent.");
  const plan = await planFor(query);
  if (!plan) return badRequest("Say what you'd love to do first.");
  const { itinerary, town } = plan;
  if (itinerary.planned === 0)
    return badRequest("Nothing in this plan could be confirmed yet.");

  return answer(async () => {
    const id = await createAdventure(db, {
      kind: "christmas",
      title: itinerary.title.slice(0, 120),
      startsOn: itinerary.day,
      endsOn: null,
      timeZone: null,
      destinationLabel: town.name,
      destinationTownId: town.id,
      displayName: user.displayName,
    });
    for (const stop of itinerary.stops) {
      if (stop.status !== "planned" || !stop.place) continue;
      const places = stop.displays ?? [stop.place];
      for (const [i, place] of places.entries()) {
        const at = i === 0 && stop.time !== undefined ? stop.time : undefined;
        await addItem(db, id, user.id, {
          atlasRef: place.source === "atlas" ? place.ref.slice(6) : null,
          label: place.title.slice(0, 120),
          note: [
            `${stop.emoji} ${stop.label}${at !== undefined ? ` · ${stop.timeIs === "about" ? "about " : ""}${clockText(at)}` : ""}`,
            place.source === "map"
              ? `${place.what} · on the community lights map: ${place.href}`
              : null,
            place.hours ?? null,
            ...stop.notes,
          ]
            .filter(Boolean)
            .join(" · ")
            .slice(0, 1000),
          status: "confirmed",
          onDay: itinerary.day,
          startsAt: at !== undefined ? stopInstant(itinerary.day, at) : null,
        });
      }
    }
    const open = itinerary.stops.filter((s) => s.status === "unresolved");
    if (open.length)
      await addItem(db, id, user.id, {
        atlasRef: null,
        label: "Still to find",
        note: open
          .map((s) => `${s.emoji} ${s.label}: ${s.reason ?? "not confirmed"}`)
          .join("\n")
          .slice(0, 1000),
        status: "proposed",
        onDay: null,
        startsAt: null,
      });
    return NextResponse.json({ id }, { status: 201 });
  });
}
