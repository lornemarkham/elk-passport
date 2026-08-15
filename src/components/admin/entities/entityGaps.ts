import type { PickerEntity } from "./EntityPicker";

/**
 * Gap predicates, in their own module so **server code can ask the same
 * questions the browser filters by**.
 *
 * `EntityPicker` is a client component. A server file importing from it
 * would drag the whole component into a server bundle, and — worse —
 * copying these predicates instead would let the Region page's diagnosis
 * and the browser's filters disagree about what "has no type" means. The
 * page would then say *6 entities have no type* above a filter that found
 * five.
 */

/**
 * A subtype Atlas does not actually know.
 *
 * Extraction writes the literal string `unknown` when a source never said
 * what something is, so an absent type and the word "unknown" are the same
 * fact wearing different clothes. Rendering `unknown` as though it were a
 * type is the fabricated-zero mistake in a text field: it looks like
 * knowledge and is the absence of it.
 *
 * This matters more than it used to. Types are about to drive layouts,
 * completeness rules, research missions and Passport presentation — so
 * "we never established the type" is a gap a curator needs to *find*, not
 * a label to skim past.
 */
export function hasRealType(e: Pick<PickerEntity, "subtype">): boolean {
  const t = (e.subtype ?? "").trim().toLowerCase();
  return t !== "" && t !== "unknown";
}
