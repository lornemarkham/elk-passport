import type { Experience } from "@/domain/experience/types";

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
 * **Whether Atlas states this is in a different area from the one being
 * browsed.**
 *
 * `false` when Atlas states no area, which is most of the corpus, and `false`
 * when there is no home area to compare against.
 */
export function elsewhere(
  experience: Experience,
  home: string | undefined,
): boolean {
  if (!home) return false;
  const area = areaOf(experience);
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
    const area = areaOf(experience);
    if (area && area !== home) counts.set(area, (counts.get(area) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);
}
