import { blunt } from "@/domain/discovery/situation";
import { isAtlasUnavailable } from "@/lib/data/atlasAuth";
import { isTravelMode } from "@/lib/routing/journey";
import { travelTimesFromAtlas } from "@/lib/routing/atlasTravel.server";

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

  try {
    const answer = await travelTimesFromAtlas(blunt(latitude, longitude), mode);
    return Response.json(answer, {
      headers: { "Cache-Control": "private, max-age=300" },
    });
  } catch (error) {
    console.error(
      `[atlas] travel reading unavailable (${isAtlasUnavailable(error) ? error.reason : "unreachable"})`,
    );
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}
