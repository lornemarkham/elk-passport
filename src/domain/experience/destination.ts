import type { Experience } from "./types";

/**
 * Where a Discover card goes when it is tapped — derived, never authored.
 *
 * The row used to hardcode `` `/places/${experience.id}` `` for everything,
 * which was harmless while Discover was Places-only and becomes a lie the
 * moment it is not: an Organization id is not a Place id, and
 * `/places/{organizationId}` is a 404 dressed up as a link.
 *
 * Three existing facts decide it, and no new flag is involved:
 *
 * 1. **kind** — which routes could possibly apply;
 * 2. **`detailReady`** — whether Atlas holds enough for a page at all;
 * 3. **`context`** — the thing that physically contains it, when Atlas says so.
 *
 * `undefined` is a real answer and the important one: a candidate with nowhere
 * truthful to go is still a candidate. Eligibility and having a destination are
 * separate questions, which is the whole reason there is no `hasDetailPage`.
 */
export function destinationFor(experience: Experience): string | undefined {
  // The only detail template Passport currently has.
  if (experience.kind === "Place" && experience.detailReady) {
    return `/places/${experience.id}`;
  }

  // No Organization, Activity or Event template exists yet. Where Atlas knows
  // what physically contains the thing, its container is a truthful place to
  // land — you reach The BullWheel through Big White, which is how you reach it
  // in life. Only when that container is a Place we can actually render.
  if (experience.context?.kind === "Place") {
    return `/places/${experience.context.id}`;
  }

  return undefined;
}
