import { distanceKm } from "@/lib/environment/geo";
import {
  APPROXIMATE_MAX_KM,
  FALLBACK_TOWN_ID,
  nearestCovered,
} from "@/domain/location/prefs";

export const dynamic = "force-dynamic";

/**
 * **A regional guess at where a visitor is, for when they have said nothing.**
 *
 * The host's network edge states roughly where a request came from
 * (`x-vercel-ip-latitude`/`-longitude`). That is a city-sized guess at best,
 * and sometimes the ISP's head office, so the answer is only ever *a covered
 * town near it* and is labelled `approximate` — the page says "around", never
 * "you are in".
 *
 * Nothing is stored or logged and no coordinate is returned: the response is a
 * town id. Where the edge says nothing, or says somewhere Passport does not
 * cover (150 km from every town), the answer is the region Passport launched
 * in, marked `default` so the page can say it is a starting point and nothing
 * more.
 */
export function GET(request: Request) {
  const lat = Number(request.headers.get("x-vercel-ip-latitude"));
  const lon = Number(request.headers.get("x-vercel-ip-longitude"));
  const stated =
    request.headers.get("x-vercel-ip-latitude") !== null &&
    Number.isFinite(lat) &&
    Number.isFinite(lon);
  const near = stated
    ? nearestCovered(
        { latitude: lat, longitude: lon },
        distanceKm,
        APPROXIMATE_MAX_KM,
      )
    : undefined;
  return Response.json(
    near
      ? { townId: near.town.id, source: "approximate" }
      : { townId: FALLBACK_TOWN_ID, source: "default" },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
