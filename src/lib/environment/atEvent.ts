import "server-only";
import { OCTOBER_PLACES, type OctoberPlace } from "@/domain/environment/places";
import type { Environment } from "@/domain/environment/types";
import { distanceKm } from "./geo";
import { environmentFor } from "./reading";

/**
 * **The forecast for where the thing actually is, not for where you live.**
 *
 * The previous pass used the home area's forecast for everything, which is
 * wrong twice over: an event in Vernon tomorrow evening is a question about
 * Vernon, and a person in Kelowna looking at it deserves Vernon's answer. This
 * resolves each subject to the nearest area Passport knows and fetches the
 * handful of distinct areas a page actually needs.
 *
 * ## Still one batch, never one request per card
 *
 * A page collects every point it cares about, this dedupes them to areas, and
 * `environmentFor` makes one provider call per distinct area — typically two
 * or three for a whole page, because October happens in a valley with a
 * handful of towns in it.
 *
 * ## It will not stretch
 *
 * A point more than `MAX_KM` from any area Passport lists gets no forecast at
 * all. Vernon's sky is not evidence about somewhere ninety kilometres up a
 * different lake, and silence beats a confident wrong answer.
 */

const MAX_KM = 25;

export function nearestPlace(
  point: { readonly latitude: number; readonly longitude: number },
  places: readonly OctoberPlace[] = OCTOBER_PLACES,
): OctoberPlace | undefined {
  let best: OctoberPlace | undefined;
  let bestKm = Number.POSITIVE_INFINITY;
  for (const place of places) {
    const km = distanceKm(point, place);
    if (km < bestKm) {
      bestKm = km;
      best = place;
    }
  }
  return bestKm <= MAX_KM ? best : undefined;
}

/**
 * Forecasts keyed by **place id**, for every place this page needs.
 *
 * `home` is always included where known, because the page's own header speaks
 * about where the person is even when nothing near them is on.
 */
export async function environmentsForPoints(
  points: Iterable<{ readonly latitude: number; readonly longitude: number }>,
  home: OctoberPlace | undefined,
): Promise<ReadonlyMap<string, Environment>> {
  const wanted = new Map<string, OctoberPlace>();
  if (home) wanted.set(home.id, home);
  for (const point of points) {
    const place = nearestPlace(point);
    if (place) wanted.set(place.id, place);
  }
  if (wanted.size === 0) return new Map();
  return environmentFor([...wanted.values()]);
}
