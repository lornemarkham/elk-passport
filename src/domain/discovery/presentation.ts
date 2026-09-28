import { localDay, nextRelevantDay } from "@/domain/october/calendar";
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

/**
 * **What a lane still has to offer once an earlier lane has had its turn.**
 *
 * Tonight answers *what can I do tonight*; This weekend answers *what **else**
 * can I do this weekend*. A multi-day run is legitimately eligible for both,
 * and before this the weekend lane opened with the same four cards the reader
 * had just finished looking at — 4 of its 6 were repeats.
 *
 * Subtracted by stable unit identity, never by title. This is composition
 * only: the removed units are untouched in Coming up, in Browse the month and
 * on their own pages, because they have not stopped being on.
 */
export function withoutAlreadyShown(
  units: readonly DiscoveryUnit[],
  alreadyShown: readonly DiscoveryUnit[],
): DiscoveryUnit[] {
  const seen = new Set(alreadyShown.map((u) => u.head.id));
  return units.filter((u) => !seen.has(u.head.id));
}

/**
 * **Beginning in the window beats merely running through it.**
 *
 * Browse the month is ordered soonest-first, and `nextRelevantDay` answers
 * "Oct 1" for anything already under way when October starts. That is correct
 * — it *is* on on the 1st — but it put a hiring window open until next June,
 * a 148-day tournament and a farmers' market at the head of the month, above
 * the things that actually happen on October 1st.
 *
 * So among units sharing a day, one whose own run starts on that day sorts
 * above one that was already running. Generic and evidence-shaped: it asks
 * *did this begin here*, not how long it lasts. No duration threshold, no
 * title, no id — a 270-day run that genuinely starts on October 1st still
 * leads that day.
 */
export function beginsWithin(
  unit: DiscoveryUnit,
  windowStart: string,
): boolean {
  const first = firstDayOf(unit);
  return first !== undefined && first >= windowStart;
}

/** The earliest day this unit's own evidence names, ignoring the window. */
function firstDayOf(unit: DiscoveryUnit): string | undefined {
  const candidates = [unit.head, ...unit.options].flatMap((e) => {
    const days = e.availability?.days ?? [];
    const start = e.startTime ? localDay(e.startTime) : undefined;
    return [...days, ...(start ? [start] : [])];
  });
  return candidates.length > 0 ? candidates.sort()[0] : undefined;
}

/**
 * Browse the month, ordered so a specific October occurrence is not buried
 * under something that has been running since June. Stable: the lane's
 * existing soonest-first order decides everything else.
 */
export function byOctoberSpecificity(
  units: readonly DiscoveryUnit[],
  windowStart: string,
): DiscoveryUnit[] {
  return units
    .map((unit, index) => ({ unit, index }))
    .sort((a, b) => {
      const A = beginsWithin(a.unit, windowStart) ? 0 : 1;
      const B = beginsWithin(b.unit, windowStart) ? 0 : 1;
      return A !== B ? A - B : a.index - b.index;
    })
    .map((x) => x.unit);
}
