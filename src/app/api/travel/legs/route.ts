import { isAtlasUnavailable } from "@/lib/data/atlasAuth";
import { isTravelMode } from "@/lib/routing/journey";
import type { PlacedLeg } from "@/lib/routing/legs";
import { travelLegsFromAtlas } from "@/lib/routing/atlasLegs.server";

/** A day has at most five stops: six legs with the way home. Room to spare. */
const MAX_LEGS = 12;

/**
 * **How long each leg of a day takes, by road or on foot** — Atlas ADR 097,
 * over Atlas's `GET /travel/legs` (`atlasLegs.ts`).
 *
 * The discipline of `/api/discovery/travel`: every point arrives in a POST
 * body, never a URL; nothing is stored; nothing is logged but the reason a
 * reading failed. A start point (an end with no Atlas `id`) is rounded to
 * ~1 km by `travelLegsQuery()` before it leaves, whatever the browser sent.
 *
 * ```
 * 200 { state: "ready", journeys }   one per leg, in order
 * 200 { state: "not-served" }        Atlas has no such endpoint yet
 * 400 { error: "legs" }              the question was not one
 * 503 { error: "unavailable" }       Atlas failed or did not answer; retry
 * ```
 */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const mode = (body as { mode?: unknown } | null)?.mode;
  const raw = (body as { legs?: unknown } | null)?.legs;
  if (
    !isTravelMode(mode) ||
    !Array.isArray(raw) ||
    raw.length === 0 ||
    raw.length > MAX_LEGS
  ) {
    return Response.json({ error: "legs" }, { status: 400 });
  }

  const legs: PlacedLeg[] = [];
  for (const item of raw) {
    const from = end((item as { from?: unknown } | null)?.from);
    const to = end((item as { to?: unknown } | null)?.to);
    if (!from || !to) return Response.json({ error: "legs" }, { status: 400 });
    legs.push({ from, to });
  }

  try {
    const answer = await travelLegsFromAtlas(legs, mode);
    return Response.json(answer, {
      headers: { "Cache-Control": "private, max-age=300" },
    });
  } catch (error) {
    console.error(
      `[atlas] travel legs unavailable (${isAtlasUnavailable(error) ? error.reason : "unreachable"})`,
    );
    return Response.json(
      { error: "unavailable" },
      { status: 503, headers: { "Retry-After": "30" } },
    );
  }
}

function end(value: unknown): PlacedLeg["from"] | undefined {
  const v = value as Record<string, unknown> | null;
  if (!v || typeof v !== "object") return undefined;
  const { latitude, longitude, id } = v;
  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    return undefined;
  }
  if (id !== undefined && (typeof id !== "string" || id.length === 0)) {
    return undefined;
  }
  // A name is not needed to route, so none is read here or sent to Atlas.
  return {
    ...(typeof id === "string" ? { id } : {}),
    name: "",
    at: { latitude, longitude },
  };
}
