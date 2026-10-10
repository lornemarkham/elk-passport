import { blunt } from "@/domain/discovery/situation";
import { weatherToday } from "@/lib/environment/today";

/**
 * **Today's forecast for roughly where the caller is.**
 *
 * ## Why this route exists at all
 *
 * Discovery resolves its weather on the server, and `navigator.geolocation`
 * exists only in the browser. There is no arrangement of server components
 * that bridges those two facts; something has to carry a position inward after
 * the page has rendered, and this is the smallest thing that can.
 *
 * ## Why POST, and why there is no `?lat=`
 *
 * A position in a query string is a position in an access log, a referrer and
 * a browser history entry. It goes in a body instead, which none of those
 * keep.
 *
 * ## What happens to the position
 *
 * It is already rounded to ~1 km by the caller (`blunt`), and rounded again
 * here rather than trusted. Then it is used to pick a bounding box, and
 * dropped when the request ends. It is **not** written to a database, a
 * cookie, a session or a log, and it is sent to exactly one outside service —
 * `api.weather.gc.ca`, whose entire purpose is to answer the question being
 * asked. Nothing else in Passport ever sees it.
 *
 * The response carries no coordinates back: a condition, a chance, the name of
 * the Environment Canada city it belongs to, and how far away that is.
 */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  // **A number, not something that coerces to one.** `JSON.stringify(NaN)` is
  // `null`, and `Number(null)` is `0` — so a browser that failed to get a fix
  // and sent null would have been answered with the weather on the equator.
  const read = (key: string): number => {
    const value = (body as Record<string, unknown> | null)?.[key];
    return typeof value === "number" ? value : Number.NaN;
  };
  const latitude = read("latitude");
  const longitude = read("longitude");
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    // No echo of what was sent. A 400 that quotes the bad input is a 400 that
    // writes the input into whatever logs the error.
    return Response.json({ error: "coordinates" }, { status: 400 });
  }

  const weather = await weatherToday(blunt(latitude, longitude), new Date());
  // An empty object is a real answer: Environment Canada publishes no city
  // near enough, or the provider is not configured. The caller says so.
  return Response.json(weather ? { weather } : {});
}
