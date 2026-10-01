import type { Experience } from "@/domain/experience/types";
import type { OctoberPlace } from "@/domain/environment/places";
import { distanceKm } from "@/lib/environment/geo";

/**
 * **How near a thing is to the October you are actually having.**
 *
 * Changing your area from Vernon to Kelowna has to change what October shows
 * you, or the area is a weather setting wearing a product's clothes.
 *
 * ## What Atlas actually gives us, measured
 *
 * ```
 * 306 dated candidates
 *  93   carry `location` — a `happens_at` Place, with a locality
 *  83   of those resolve to a Place that has real coordinates
 *   0   carry coordinates of their own
 *  19   carry a regionId, and there is only ONE region in the corpus
 * ```
 *
 * So region membership cannot tell Vernon from Kelowna — the whole valley is
 * one asserted region — and an Event never knows where it is. The only honest
 * geography available is the `happens_at` edge, and it is enough: 36 of the
 * dated things are in Vernon and 25 in Kelowna, which is a materially
 * different October.
 *
 * Crucially the Place's coordinates arrive **in the same candidate feed**, so
 * resolving them costs nothing — no second request, no request per card.
 *
 * ## Undecidable is not far away
 *
 * Two thirds of dated things have no location Atlas will vouch for. They are
 * **not** demoted below things that are genuinely distant, and they are never
 * hidden: an unplaced subject is one Atlas has not told us about, not one that
 * is far. It sorts after the near things and before the far ones, which is the
 * only ordering that does not pretend to know something.
 *
 * Nothing here infers a location from a name, a phone number or a publisher.
 */

/** How near, as a product decision rather than a number. */
export type Nearness = "here" | "nearby" | "a-drive" | "unknown";

/**
 * Your own town, then the places you would go without calling it a trip.
 *
 * 30 km is the measured line rather than a round number: it is the radius at
 * which the Vernon and Kelowna sets genuinely diverge (45 dated things near
 * Vernon, 39 near Kelowna), and it correctly puts Kelowna 43 km away in the
 * "that is a drive" bucket from Vernon — which it is, at three quarters of an
 * hour each way.
 */
const HERE_KM = 15;
const NEARBY_KM = 30;

export interface Localness {
  readonly nearness: Nearness;
  /** Kilometres, where it is known. Never shown raw; used for ordering. */
  readonly km?: number;
  /** The town Atlas asserted, where it has one — "Vernon". */
  readonly locality?: string;
}

/**
 * A lookup from Place id to coordinates, built once per page from the same
 * candidate list everything else reads.
 */
export type PlacePoints = ReadonlyMap<
  string,
  { readonly latitude: number; readonly longitude: number }
>;

export function localnessOf(
  experience: Experience,
  from: OctoberPlace | undefined,
  points: PlacePoints,
): Localness {
  const locality = experience.venue?.locality;
  const placeId = experience.venue?.placeId;
  const point = placeId ? points.get(placeId) : undefined;

  if (!from || !point) {
    return locality
      ? { nearness: "unknown", locality }
      : { nearness: "unknown" };
  }

  const km = distanceKm(from, point);
  const nearness: Nearness =
    km <= HERE_KM ? "here" : km <= NEARBY_KM ? "nearby" : "a-drive";
  return locality ? { nearness, km, locality } : { nearness, km };
}

/** Sort rank: what is here, then what is unplaced, then what is a drive. */
const RANK: Record<Nearness, number> = {
  here: 0,
  nearby: 1,
  unknown: 2,
  "a-drive": 3,
};

/**
 * **Nearest first, with the unplaced kept in the middle.**
 *
 * A stable re-ordering rather than a filter. Nothing is removed, because a
 * person who set their area to Vernon has not asked to stop being told about
 * Kelowna — they have asked for Vernon to come first.
 */
export function byNearest<T>(
  of: (item: T) => Localness,
): (a: T, b: T) => number {
  return (a, b) => {
    const x = of(a);
    const y = of(b);
    if (RANK[x.nearness] !== RANK[y.nearness]) {
      return RANK[x.nearness] - RANK[y.nearness];
    }
    if (x.km !== undefined && y.km !== undefined && x.km !== y.km) {
      return x.km - y.km;
    }
    return 0;
  };
}
