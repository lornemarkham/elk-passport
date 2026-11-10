import type { Experience } from "@/domain/experience/types";
import { DISCOVERY_TOWNS } from "@/domain/discovery/towns";
import { distanceKm } from "@/lib/environment/geo";

/**
 * **Why Vancouver was on a page about the Okanagan.**
 *
 * Measured against production Atlas on 2026-10-11:
 *
 * ```
 * GET /regions          404 — the route does not exist
 * GET /admin/regions    "Missing or invalid x-admin-token"
 * ADMIN_TOKEN           not set in Vercel production
 * ```
 *
 * `activeScope()` reads `listRegions()`, which needs an admin token Passport's
 * production environment does not have, catches the failure and returns `[]`.
 * So **Discovery has had no geographic scope at all in production**: no region,
 * no narrowing, and no `active-scope` label either — the whole 2,683-candidate
 * corpus, province-wide, every time.
 *
 * ## And fixing the token would not have fixed this
 *
 * Region membership is asserted, and Atlas has asserted it for **316 of 2,683
 * candidates**. `matchesScope` fails closed by design (ADR 025 — an entity in
 * no region is not adopted by one), so a working region scope would have
 * removed 88% of the corpus from the page, including almost everything in
 * Vernon. The instrument was wrong, not just unplugged.
 *
 * ## What Atlas does state
 *
 * `candidate-geography/2` carries an **area** per candidate, and it is already
 * read here — it is what puts `METRO VANCOUVER` on a card:
 *
 * ```
 * Okanagan          828
 * Metro Vancouver    34
 * (none stated)   1,818
 * ```
 *
 * That is the signal. Thirty-four candidates are stated to be somewhere else,
 * and those are exactly the ones that should not lead an ordinary local page.
 *
 * ## The rule, and the half of it that matters more
 *
 * **Only a stated, different area excludes anything.** The 1,818 candidates
 * Atlas has not placed stay, every one of them. Treating silence as distance
 * is the oldest mistake in this product — it is the same error as reading
 * `unknown` as `unsuitable`, and it would remove most of Vernon to get rid of
 * Vancouver.
 *
 * Nothing is deleted from Atlas and nothing is unreachable: search, `?intent=`
 * and the explicit *further afield* control all still reach every one of the
 * thirty-four. This decides what leads an ordinary page, which is a different
 * question from what exists.
 */

/** The area Atlas states for this, or `undefined`. Never inferred. */
export const areaOf = (experience: Experience): string | undefined =>
  experience.geography?.area?.name?.trim() || undefined;

/**
 * **How close a stated position must be to a named town to say which area it
 * is in.** Okanagan towns are at most ~50 km apart and Vancouver is ~300 km
 * from the nearest of them, so 60 km separates the two regions without
 * guessing about the country between them.
 */
const PLACED_BY_TOWN_KM = 60;

/**
 * **The area a subject is in: the one Atlas states, else the one its stated
 * coordinates fall in.**
 *
 * Measured on the 2026-11-08 production corpus, 167 subjects carried
 * coordinates ~300 km from Vernon (Vancouver public art) and **no** stated
 * area, so "only a stated area excludes" let them into an Okanagan page.
 * Coordinates are a stated fact; the nearest named town to them, within
 * {@link PLACED_BY_TOWN_KM}, says which area they are in. Nothing stated and
 * nothing near a town stays `undefined`: silence still removes nothing.
 */
export function placedAreaOf(experience: Experience): string | undefined {
  const stated = areaOf(experience);
  if (stated) return stated;
  const c = experience.geography?.coordinates;
  if (!c) return undefined;
  const here = { latitude: c[1], longitude: c[0] };
  let best: { area: string; km: number } | undefined;
  for (const town of DISCOVERY_TOWNS) {
    const km = distanceKm(here, town);
    if (!best || km < best.km) best = { area: town.area, km };
  }
  return best && best.km <= PLACED_BY_TOWN_KM ? best.area : undefined;
}

/**
 * **Whether this is in a different area from the one being browsed** — by
 * what Atlas states, or failing that by where its stated coordinates are.
 *
 * `false` when nothing places it, which is most of the corpus, and `false`
 * when there is no home area to compare against.
 */
export function elsewhere(
  experience: Experience,
  home: string | undefined,
): boolean {
  if (!home) return false;
  const area = placedAreaOf(experience);
  return area !== undefined && area !== home;
}

/** The pool without the things Atlas places in another area. */
export const withoutElsewhere = (
  experiences: readonly Experience[],
  home: string | undefined,
): readonly Experience[] =>
  home ? experiences.filter((e) => !elsewhere(e, home)) : experiences;

/** How many are being held back, so the offer to see them can be honest. */
export const countElsewhere = (
  experiences: readonly Experience[],
  home: string | undefined,
): number => (home ? experiences.filter((e) => elsewhere(e, home)).length : 0);

/** The other areas Atlas names in this pool, most-stated first. */
export function otherAreas(
  experiences: readonly Experience[],
  home: string | undefined,
): readonly string[] {
  const counts = new Map<string, number>();
  for (const experience of experiences) {
    const area = placedAreaOf(experience);
    if (area && area !== home) counts.set(area, (counts.get(area) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);
}
