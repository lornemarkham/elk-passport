import type { Place, PlaceKeyFact } from "@/lib/data/types";

/**
 * **Which key facts are worth their own line, and how they group.**
 *
 * Atlas states these; Passport only decides what is already on the page. The
 * wording is never touched — a "summary" of a publisher's sentence is Passport
 * asserting something no source said, which is the one thing a page built on
 * evidence must not do.
 *
 * ## Why anything is dropped at all
 *
 * The page already renders hours, fees, accessibility and facilities from their
 * own typed fields, above this section. A key fact repeating one of those is
 * the same sentence twice, and the second one reads like an oversight. So a
 * fact is suppressed only when the page **demonstrably already shows that
 * thing** — never because it looked unimportant.
 */

/** Labels the page renders elsewhere, matched loosely on the publisher's word. */
const ALREADY_SHOWN: readonly { pattern: RegExp; shownWhen: (place: Place) => boolean }[] = [
  { pattern: /^(hours?|opening hours|operating hours)$/i, shownWhen: (p) => Boolean(p.hours) },
  {
    pattern: /^(fees?|admission|cost|price|pricing)$/i,
    shownWhen: (p) => p.feeRequired !== undefined,
  },
  {
    pattern: /^(accessibility|wheelchair( access)?)$/i,
    shownWhen: (p) => Boolean(p.wheelchairAccessible),
  },
  {
    pattern: /^(facilities|amenities)$/i,
    shownWhen: (p) => (p.facilities?.length ?? 0) > 0,
  },
];

function isDuplicate(fact: PlaceKeyFact, place: Place): boolean {
  return ALREADY_SHOWN.some(
    (rule) => rule.pattern.test(fact.label.trim()) && rule.shownWhen(place),
  );
}

/** Empty label or value means the extractor produced nothing worth a line. */
const isSubstantive = (fact: PlaceKeyFact): boolean =>
  fact.label.trim().length > 0 && fact.value.trim().length > 0;

export interface KeyFactGroup {
  /** Atlas's own category, or `undefined` for the ungrouped ones. */
  readonly category?: string;
  readonly facts: readonly PlaceKeyFact[];
}

/**
 * Group by Atlas's `category` where a source supplied one, preserving the order
 * facts arrived in.
 *
 * Ungrouped facts come **first** and unlabelled: most places have only those,
 * and leading with a heading like "Other" for the whole section would be a
 * category Passport invented. A real category — "Locals' favourite launch
 * spots" — is a publisher's own editorial grouping and is worth keeping.
 */
export function groupKeyFacts(place: Place): KeyFactGroup[] {
  const usable = (place.keyFacts ?? []).filter(
    (fact) => isSubstantive(fact) && !isDuplicate(fact, place),
  );

  if (usable.length === 0) return [];

  const ungrouped = usable.filter((fact) => !fact.category?.trim());
  const groups: KeyFactGroup[] = ungrouped.length > 0 ? [{ facts: ungrouped }] : [];

  const seen = new Map<string, PlaceKeyFact[]>();
  for (const fact of usable) {
    const category = fact.category?.trim();
    if (!category) continue;
    if (!seen.has(category)) seen.set(category, []);
    seen.get(category)!.push(fact);
  }

  for (const [category, facts] of seen) groups.push({ category, facts });

  return groups;
}
