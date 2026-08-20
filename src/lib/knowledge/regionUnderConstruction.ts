import type { RegionSummary } from "./regions";

/**
 * **Which Region every placement figure is counted against.**
 *
 * ## The bug this exists to prevent
 *
 * `loadAtlasFacts` used to build its placed-entity set with
 * `regions.flatMap((r) => r.memberIds)` — the union of **every** region Atlas
 * holds. Atlas holds two (Okanagan and Shuswap Highland), so an entity a
 * curator placed in Shuswap Highland counted as placed in the Okanagan, and
 * *"5 placed in Okanagan"* was not a statement about the Okanagan at all. The
 * same two lines took `regions[0]` for the region's **name**, so the heading
 * was whichever region Atlas happened to return first.
 *
 * A Knowledge Domain's progress is always progress *within one Region*. There
 * is exactly one correct answer to "placed here", and unioning regions is not
 * an approximation of it — it is a different number wearing its label.
 *
 * ## Why the Region is asserted rather than derived
 *
 * There is no derivable answer to *"which region is being built"*. Atlas holds
 * regions; it holds no fact about which one an operator is working on. The
 * candidates were:
 *
 * - `regions[0]` — the bug, restated. Arbitrary order is not a decision.
 * - The largest by member count — a heuristic, and a heuristic that would
 *   silently switch regions the moment the other one grew.
 * - **Asserted, once, here** — which is what the product already says out loud:
 *   the admin calls Okanagan *"the benchmark region"* in two places, and the
 *   whole surface is titled *Build the Okanagan*.
 *
 * So it is asserted, in one named constant, with the assertion visible. When
 * Atlas eventually holds a fact about the region under construction — a flag, a
 * setting, a route parameter — this function is the single place that changes.
 *
 * ## An unresolvable Region is stated, never defaulted
 *
 * If no region carries this name, this returns `undefined` rather than falling
 * back to *some* region. A fallback would quietly begin counting a different
 * region's members, which is the bug again with better manners. Callers turn
 * `undefined` into an *unverifiable* reading — because "we could not identify
 * the region" and "nothing is placed in it" are different facts, and reporting
 * the second when the first is true is the fabricated zero this codebase keeps
 * rediscovering.
 */
export const REGION_UNDER_CONSTRUCTION = "Okanagan";

/**
 * The Region every Knowledge Domain figure is scoped to.
 *
 * Matched on name, case-insensitively and trimmed, because the name is what a
 * curator typed into `define-region` and casing is not a meaningful difference.
 * Nothing else is matched on — no prefix, no fuzzy comparison. Atlas forbids
 * resolving *identity* by approximate name, and while this is selection rather
 * than identity, there is no reason to be looser than the rest of the system.
 */
export function selectRegionUnderConstruction(
  regions: readonly RegionSummary[],
): RegionSummary | undefined {
  const wanted = REGION_UNDER_CONSTRUCTION.trim().toLowerCase();
  return regions.find((region) => region.name.trim().toLowerCase() === wanted);
}

/**
 * The ids a curator has placed in that one Region.
 *
 * Direct `contains` members only — the same set `/admin/regions` serves and the
 * same definition `RegionMembershipService.assert` writes into. Indirect
 * containment (a venue inside a placed resort) is a different question with a
 * different answer, and `regionScope.ts` owns it.
 */
export function placedIdsFor(
  region: RegionSummary | undefined,
): ReadonlySet<string> {
  return new Set(region?.memberIds ?? []);
}
