import { listDiscoveryDistances } from "@/lib/data/atlas-repo";
import { blunt } from "@/domain/discovery/situation";
import { isAtlasUnavailable } from "@/lib/data/atlasAuth";

/**
 * **How far everything Atlas could place is from one origin** — ADR 094.
 *
 * Discovery's origin is either a town somebody picked or a position their
 * browser shared, and the second exists only in the browser. This carries
 * either inward, the same way `/api/environment/here` carries a position for
 * the forecast: in a **POST body**, never a query string, so it reaches no
 * access log, referrer or history entry on Passport's side.
 *
 * Rounded to ~1 km here rather than trusted, and sent to exactly one place —
 * Atlas, whose job is to answer it. Atlas rounds it again on receipt. Nothing
 * is stored, logged or returned except the reading itself: an id and a
 * distance state per candidate, never a coordinate.
 */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const read = (key: string): number => {
    const value = (body as Record<string, unknown> | null)?.[key];
    return typeof value === "number" ? value : Number.NaN;
  };
  const latitude = read("latitude");
  const longitude = read("longitude");
  const withinKm = read("withinKm");
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180 ||
    !Number.isFinite(withinKm) ||
    withinKm <= 0 ||
    withinKm > 500
  ) {
    return Response.json({ error: "origin" }, { status: 400 });
  }

  const point = blunt(latitude, longitude);
  try {
    const reading = await listDiscoveryDistances(
      point.latitude,
      point.longitude,
      withinKm,
    );
    return Response.json(reading, {
      headers: { "Cache-Control": "private, max-age=300" },
    });
  } catch (error) {
    // The operator's detail goes to the log; the coordinate does not.
    console.error(
      `[atlas] distance reading unavailable (${isAtlasUnavailable(error) ? error.reason : "unreachable"})`,
    );
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}
