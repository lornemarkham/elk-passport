import type { Experience } from "@/domain/experience/types";

/**
 * **The one place Passport decides which region it is showing.**
 *
 * Atlas asserts region membership and serves it on every candidate. Passport
 * discarded it: `candidateToExperience` never read `regionIds`, `Experience` had
 * no field for it, and nothing downstream could have filtered on it. With one
 * region that is invisible — everything Atlas holds is Okanagan-ish, so a feed
 * with no scope looks correct. With two it silently mixes Vancouver into an
 * Okanagan feed, and the bug is in the seam, not in whatever component notices.
 *
 * So the seam exists now, while there is still only one region and nothing to
 * get wrong.
 *
 * ## No region is a real answer, and it is today's answer
 *
 * `activeRegionId()` returns `undefined`, meaning *no scope*: show everything
 * Atlas offers. That is exactly the current behaviour, and it is deliberately
 * **not** "default to the Okanagan" — Passport must never hold the assumption
 * that its one region is the product. When a second region is defined, this
 * function is where the choice is made, and it is the only thing that changes.
 *
 * ## An unplaced entity is unscoped, never adopted
 *
 * 136 of Atlas's 200 entities belong to no region. Under a scope they are
 * **excluded**, not silently claimed by whichever region happens to be active.
 * A region's feed shows what has been placed in it — the same honesty
 * `unassignedEntities` enforces on the Atlas side (ADR 025), where the unplaced
 * are counted out loud rather than hidden.
 *
 * ## Membership is a list, and scoping respects that
 *
 * `regionIds` is plural because an entity can be placed in more than one region,
 * and an entity in two regions appears under both. Nothing here decides which is
 * "primary" — Atlas does not model that, so Passport does not invent it.
 */

/**
 * The region Passport is currently showing, or `undefined` for no scope.
 *
 * **This is the seam.** Today it is a constant; tomorrow it reads a route
 * segment, a subdomain or a stored preference. Nothing else in Passport should
 * ever hardcode a region id.
 */
export function activeRegionId(): string | undefined {
  return undefined;
}

/** Whether this experience belongs to the active region. No scope means everything qualifies. */
export function inRegion(
  experience: Experience,
  regionId: string | undefined,
): boolean {
  if (!regionId) return true;
  return experience.regionIds.includes(regionId);
}

/**
 * Narrow a list to the active region — applied to the whole pool, so browse,
 * search and the default feed all obey the same scope rather than three.
 */
export function scopeToRegion(
  experiences: readonly Experience[],
  regionId: string | undefined,
): Experience[] {
  if (!regionId) return [...experiences];
  return experiences.filter((experience) => inRegion(experience, regionId));
}
