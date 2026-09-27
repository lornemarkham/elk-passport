import { nextRelevantDay } from "@/domain/october/calendar";
import type { DiscoveryUnit } from "./discoveryUnits";

/**
 * **How much of a discovery can actually be drawn.**
 *
 * Presentation only. Nothing here reorders a lane, scores quality, or decides
 * that one thing is better than another — the corpus supports no such claim
 * and Passport does not invent one. These are questions about *what is known*,
 * which is a fact about the record rather than an opinion about the night out.
 *
 * ## Why this exists at all
 *
 * A quarter of the datable corpus carries a picture and three quarters do not.
 * A page that gives every card a large image well ends up three quarters empty
 * boxes, and a page that gives none of them one throws away the single most
 * useful thing a person has for deciding what looks fun. So the treatment
 * follows the evidence: the things that can be shown, are.
 */

/** Whether a unit can carry a picture at all. */
export const hasMedia = (unit: DiscoveryUnit): boolean =>
  Boolean(unit.head.heroMedia?.src);

/**
 * How many of the useful facts a card wants are actually present.
 *
 * Used only to prefer a fuller record for a larger slot. A thin record is not
 * demoted out of a lane for being thin — it is still true, and hiding it would
 * be truth manipulation rather than presentation.
 */
export function knownFacts(unit: DiscoveryUnit): number {
  const e = unit.head;
  let n = 0;
  if (e.heroMedia?.src) n += 1;
  if (e.startTime || (e.availability?.days?.length ?? 0) > 0) n += 1;
  if (e.shortDescription && e.shortDescription.trim().length > 0) n += 1;
  if (unit.options.length > 0) n += 1;
  return n;
}

/**
 * Which unit gets the large treatment.
 *
 * **The lane's order is not touched.** It is already soonest-first, and that
 * ordering is temporal truth rather than a display preference. This only
 * decides which of them is drawn big: the earliest one that can carry a
 * picture, and otherwise simply the earliest. No "best", no "featured", no
 * ranking the corpus cannot support.
 */
export function leadOf(
  units: readonly DiscoveryUnit[],
): DiscoveryUnit | undefined {
  if (units.length === 0) return undefined;
  return units.find(hasMedia) ?? units[0];
}

/** The lane with its lead taken out, in the order it already had. */
export function withoutLead(units: readonly DiscoveryUnit[]): DiscoveryUnit[] {
  const lead = leadOf(units);
  return lead ? units.filter((u) => u.head.id !== lead.head.id) : [...units];
}

export interface DayGroup {
  /** `YYYY-MM-DD`, local. */
  readonly day: string;
  readonly units: readonly DiscoveryUnit[];
}

/**
 * A lane as a calendar rather than a wall.
 *
 * Grouped by the day a unit *next* happens, which is the same question the
 * lanes already ask, so a haunt with eight nights appears under the next one
 * rather than eight times. Days arrive in order; units keep the order the lane
 * gave them. Anything with no day ahead is left out entirely — there is no day
 * to file it under and inventing one would be fabricating a date.
 */
export function byDay(
  units: readonly DiscoveryUnit[],
  fromDay: string,
): DayGroup[] {
  const groups = new Map<string, DiscoveryUnit[]>();
  for (const unit of units) {
    const day =
      nextRelevantDay(unit.head, fromDay) ??
      unit.options
        .map((o) => nextRelevantDay(o, fromDay))
        .find((d): d is string => Boolean(d));
    if (!day) continue;
    const bucket = groups.get(day);
    if (bucket) bucket.push(unit);
    else groups.set(day, [unit]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([day, list]) => ({ day, units: list }));
}
