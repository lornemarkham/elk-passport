import type { Experience } from "@/domain/experience/types";

/**
 * **One attraction is one discovery, even when Atlas holds it as four things.**
 *
 * ## What a person saw
 *
 * Tonight, on a night the Black Mountain Haunted House was open, read:
 *
 * ```
 * Evening Haunt          Live actors · timed entry · full scares
 * Family Fun Hours       Lights up · no actors · little ones welcome
 * ```
 *
 * Two cards, neither of which names the attraction, beside a third card for the
 * attraction itself and a fourth for the company that runs it. Every one of
 * those is a real and useful distinction *in Atlas* — a mode charges its own
 * price and runs its own hours — and none of them is a separate thing to go and
 * do on a Saturday.
 *
 * ## The rule
 *
 * Atlas says which candidates are parts of another, with an `includes` edge it
 * holds as evidence (ADR 054). A lane's matches are grouped by that edge: the
 * whole becomes the card, and the parts that matched become the options inside
 * it. Nothing else groups anything —
 *
 * ```
 * includes    groups          the whole and its parts
 * offers      does NOT        a company is context on a thing, not the thing.
 *                             Caravan Farm Theatre offers The Fall of the House
 *                             of Usher, and the production is what a person is
 *                             looking for, not the company.
 * hosts       does NOT        a venue is where, not what
 * contains    does NOT        being inside a park is not being part of an
 *                             attraction; that is `context`
 * near        does NOT        proximity is not parthood
 * describes   does NOT        a source is evidence, not a parent
 * a shared name, address or coordinate   does NOT. An asserted edge is
 *                             evidence; a coincidence is not.
 * ```
 *
 * ## What it refuses to do
 *
 * - **Nothing is merged and nothing is hidden.** A unit is a way of presenting
 *   the same Things; every one keeps its own id, and a part is still reachable
 *   as itself.
 * - **A whole never inherits its parts' availability.** If only the Evening
 *   Haunt is on tonight, the unit lists the Evening Haunt and not the family
 *   hours, and if neither is on the attraction does not enter a dated lane
 *   merely because it exists. Whether a lane matched is decided before this
 *   function sees anything (`october/calendar.ts`), which is why grouping
 *   cannot smuggle a Thing into a night it never claimed.
 * - **A part whose whole Atlas does not offer stands on its own.** Grouping
 *   under something the feed cannot show would be worse than not grouping.
 */

export interface DiscoveryUnit {
  /** The card: the whole where one is asserted, otherwise the Thing itself. */
  readonly head: Experience;
  /**
   * The parts of `head` that the lane matched, in the lane's own order. Empty
   * when the head matched on its own account — an ordinary Event, a park.
   */
  readonly options: readonly Experience[];
}

/** How far a chain of `includes` edges is followed. A part of a part of a part is a data shape nobody has, and an unbounded walk is a crawler. */
const MAX_PARTHOOD_DEPTH = 3;

/**
 * The whole a Thing should be presented under, following asserted `includes`
 * edges while they lead somewhere the feed can show. Cycle-safe and bounded.
 */
function headOf(
  experience: Experience,
  byId: ReadonlyMap<string, Experience>,
): Experience {
  let current = experience;
  const seen = new Set([current.id]);
  for (let hop = 0; hop < MAX_PARTHOOD_DEPTH; hop += 1) {
    const whole = current.partOf ? byId.get(current.partOf.id) : undefined;
    if (!whole || seen.has(whole.id)) return current;
    seen.add(whole.id);
    current = whole;
  }
  return current;
}

/**
 * A lane's matches, as the discoveries a person would recognise.
 *
 * `matched` is what a window selected; `all` is everything the feed holds, so a
 * whole that did not match itself can still be named as the card. Order follows
 * the lane: a unit appears where its first matching member did.
 */
export function asDiscoveryUnits(
  matched: readonly Experience[],
  all: readonly Experience[],
): DiscoveryUnit[] {
  const byId = new Map(all.map((e) => [e.id, e]));
  const order: string[] = [];
  const heads = new Map<string, Experience>();
  const options = new Map<string, Experience[]>();

  for (const experience of matched) {
    const head = headOf(experience, byId);
    if (!heads.has(head.id)) {
      heads.set(head.id, head);
      options.set(head.id, []);
      order.push(head.id);
    }
    if (head.id !== experience.id) options.get(head.id)!.push(experience);
  }

  return order.map((id) => ({
    head: heads.get(id)!,
    options: options.get(id)!,
  }));
}

/**
 * The options, named for a card. Only what the lane matched, and only ever the
 * publisher's own names — never "and more", never a count of things not shown.
 */
export const namesOf = (unit: DiscoveryUnit): readonly string[] =>
  unit.options.map((option) => option.title);
