import { NextResponse } from "next/server";
import {
  answer,
  bodyOf,
  badRequest,
  requireAdventureSession,
} from "@/lib/adventures/server";
import { addItem, createAdventure } from "@/lib/adventures/store";
import { ATLAS_REF } from "@/lib/adventures/rules";
import { todayIn } from "@/lib/adventures/overview";
import { isSameOrigin, crossSiteRefused } from "@/lib/server/sameOrigin";
import { lightsFor, viewer } from "../../../_server/lights";
import { nearestTown } from "@/domain/christmas/lights/actions";
import { KIND_LABEL } from "@/domain/christmas/lights/model";
import {
  directionsUrl,
  tourQuery,
  type Mode,
} from "@/domain/christmas/lights/tour";

export const dynamic = "force-dynamic";

interface SentStop {
  id: string;
  name?: string;
  lat?: number;
  lng?: number;
}

/**
 * **Save my lights tour as an adventure** — a Christmas adventure on the
 * adventures core (kind `christmas`, ADR 009/012), its stops one day's items
 * in tour order, so inviting the family, Today's adventure, memories and the
 * recap all work unchanged. A pin goes on only if this person may see it
 * published; its address only when the map shows it.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return crossSiteRefused();
  const session = await requireAdventureSession();
  if ("response" in session) return session.response;
  const body = (await bodyOf(request)) as Record<string, unknown> | null;
  if (!body) return badRequest("Nothing was sent.");
  const sent = Array.isArray(body.stops)
    ? (body.stops as SentStop[]).slice(0, 20)
    : [];
  if (sent.length === 0) return badRequest("A tour needs at least one stop.");
  const mode: Mode = body.mode === "walk" ? "walk" : "drive";
  const from = { lat: Number(body.fromLat), lng: Number(body.fromLng) };
  if (!Number.isFinite(from.lat) || !Number.isFinite(from.lng))
    return badRequest("Where does it start?");
  const day =
    typeof body.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.day)
      ? body.day
      : todayIn();

  const v = await viewer();
  const { pins } = await lightsFor(v);
  const byId = new Map(
    pins.filter((p) => p.status === "approved").map((p) => [p.id, p]),
  );

  const items: {
    label: string;
    note: string | null;
    atlasRef: string | null;
    at: { lat: number; lng: number };
  }[] = [];
  for (const s of sent) {
    if (typeof s?.id !== "string") continue;
    if (s.id.startsWith("atlas:")) {
      const ref = s.id.slice(6);
      if (
        !ATLAS_REF.test(ref) ||
        !Number.isFinite(s.lat) ||
        !Number.isFinite(s.lng)
      )
        continue;
      items.push({
        label: String(s.name ?? "Festive stop").slice(0, 120),
        note: null,
        atlasRef: ref,
        at: { lat: s.lat!, lng: s.lng! },
      });
      continue;
    }
    const pin = byId.get(s.id);
    if (!pin) continue;
    // Published, so its address (if any) is one the map already shows.
    const where = pin.address ?? null;
    items.push({
      label: `${pin.name}`.slice(0, 120),
      note: [
        KIND_LABEL[pin.kind],
        where,
        pin.hours ? `Viewing: ${pin.hours}` : null,
        `Map: /christmas/lights/${pin.id}`,
      ]
        .filter(Boolean)
        .join(" · ")
        .slice(0, 1000),
      atlasRef: null,
      at: pin.at,
    });
  }
  if (items.length === 0)
    return badRequest("None of those stops are on the map any more.");

  const title =
    typeof body.title === "string" && body.title.trim()
      ? body.title.trim().slice(0, 120)
      : "Our Christmas lights tour";

  return answer(async () => {
    const id = await createAdventure(session.db, {
      kind: "christmas",
      title,
      startsOn: day,
      endsOn: null,
      timeZone: "America/Vancouver",
      destinationLabel: null,
      destinationTownId: nearestTown(from),
      displayName: session.user.displayName,
    });
    for (const item of items)
      await addItem(session.db, id, session.user.id, {
        atlasRef: item.atlasRef,
        label: item.label,
        note: item.note,
        status: "confirmed",
        onDay: day,
        startsAt: null,
      });
    const directions = directionsUrl(
      from,
      mode,
      items.map((i) => i.at),
    );
    await addItem(session.db, id, session.user.id, {
      atlasRef: null,
      label: "The route",
      note: [
        `Lights tour (${mode === "walk" ? "walking" : "driving"}): /christmas/lights/tour?${tourQuery({ from, mode, stops: sent.map((s) => s.id) })}`,
        directions ? `Directions: ${directions}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
        .slice(0, 1000),
      status: "proposed",
      onDay: null,
      startsAt: null,
    });
    return NextResponse.json(
      { id, href: `/christmas/adventure/${id}`, stops: items.length },
      { status: 201 },
    );
  });
}
