import { blunt } from "@/domain/discovery/situation";
import { isAtlasUnavailable } from "@/lib/data/atlasAuth";
import { isTravelMode } from "@/lib/routing/journey";
import { travelTimesFromAtlas } from "@/lib/routing/atlasTravel.server";
import {
  discoveryTravelLimiter,
  guardTravel,
} from "@/lib/routing/travelGuard.server";

/** travel-legs/1: after a provider failure, back off at least a minute. */
const RETRY_AFTER_SECONDS = 60;

/**
 * **How long to get to everything Atlas can route to, from one origin** —
 * Atlas ADR 097, proposed.
 *
 * The same discipline as `/api/discovery/distance`: the origin arrives in a
 * POST body, never a URL; it is blunted to ~1 km here rather than trusted;
 * it goes to Atlas and nowhere else; nothing is stored or logged but the
 * reason a reading failed.
 *
 * Until Atlas serves travel times this answers `{ state: "not-served" }` with
 * a 200 — Atlas answered, it just has nothing to say — and a surface keeps
 * showing straight-line distance, labelled as such.
 *
 * Every caller can spend Atlas's shared provider quota, so the caller is
 * checked first (`guardTravel`: same origin, a per-client rate limit, and a
 * session only when `TRAVEL_REQUIRE_SESSION=1`), and the same ~1 km cell and
 * mode is answered from this instance's memo for five minutes.
 */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const field = (key: string): unknown =>
    (body as Record<string, unknown> | null)?.[key];
  const latitude = field("latitude");
  const longitude = field("longitude");
  const mode = field("mode");
  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180 ||
    !isTravelMode(mode)
  ) {
    return Response.json({ error: "origin" }, { status: 400 });
  }

  const refused = await guardTravel(request, discoveryTravelLimiter);
  if (refused) return refused;

  try {
    const answer = await travelTimesFromAtlas(blunt(latitude, longitude), mode);
    return Response.json(answer, {
      headers: {
        "Cache-Control":
          answer.state === "ready" && answer.temporary
            ? "no-store"
            : "private, max-age=300",
      },
    });
  } catch (error) {
    console.error(
      `[atlas] travel reading unavailable (${isAtlasUnavailable(error) ? error.reason : "unreachable"})`,
    );
    return Response.json(
      { error: "unavailable" },
      {
        status: 503,
        headers: { "Retry-After": String(RETRY_AFTER_SECONDS) },
      },
    );
  }
}
