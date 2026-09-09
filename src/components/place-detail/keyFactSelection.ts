import type { Place, PlaceKeyFact, PlaceOperator } from "@/lib/data/types";

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
const ALREADY_SHOWN: readonly {
  pattern: RegExp;
  shownWhen: (place: Place) => boolean;
}[] = [
  {
    pattern: /^(hours?|opening hours|operating hours)$/i,
    shownWhen: (p) => Boolean(p.hours),
  },
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
  /**
   * The Organization that supplied these, when they came from an operator
   * rather than from the Place itself.
   *
   * Kept so the page can say so. Knowledge composed across an `operates` edge
   * must never look as though it was stored on the Place — the two are separate
   * entities in Atlas and stay separate on screen.
   */
  readonly operator?: { readonly id: string; readonly name: string };
}

/** Same label and same sentence is the same fact, however it is punctuated. */
const factKey = (fact: PlaceKeyFact): string =>
  `${fact.label.trim().toLowerCase()}|${fact.value.trim().toLowerCase().replace(/\s+/g, " ")}`;

/**
 * Group by Atlas's `category` where a source supplied one, preserving the order
 * facts arrived in.
 *
 * Ungrouped facts come **first** and unlabelled: most places have only those,
 * and leading with a heading like "Other" for the whole section would be a
 * category Passport invented. A real category — "Locals' favourite launch
 * spots" — is a publisher's own editorial grouping and is worth keeping.
 */
function groupsFor(
  facts: readonly PlaceKeyFact[],
  operator?: { id: string; name: string },
): KeyFactGroup[] {
  if (facts.length === 0) return [];

  const ungrouped = facts.filter((fact) => !fact.category?.trim());
  const groups: KeyFactGroup[] =
    ungrouped.length > 0 ? [{ facts: ungrouped, operator }] : [];

  const byCategory = new Map<string, PlaceKeyFact[]>();
  for (const fact of facts) {
    const category = fact.category?.trim();
    if (!category) continue;
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category)!.push(fact);
  }

  for (const [category, grouped] of byCategory) {
    groups.push({ category, facts: grouped, operator });
  }

  return groups;
}

/**
 * The Place's own facts, then each proven operator's, attributed.
 *
 * Order is the point: a traveller reads what this place says about itself
 * first, and an operator's facts follow under its own name, so nothing
 * composed across an `operates` edge is mistaken for something the Place
 * stated.
 *
 * Deduplication runs across the whole page rather than within each source.
 * Big White's operator repeats "Telephone" five times in its own record, and a
 * fact the Place already states is not worth repeating under the operator's
 * name either.
 */
export function groupKeyFacts(
  place: Place,
  operators: readonly PlaceOperator[] = [],
): KeyFactGroup[] {
  const seen = new Set<string>();

  const admit = (facts: readonly PlaceKeyFact[]): PlaceKeyFact[] =>
    facts.filter((fact) => {
      if (!isSubstantive(fact) || isDuplicate(fact, place)) return false;
      const key = factKey(fact);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  const groups = groupsFor(admit(place.keyFacts ?? []));

  for (const operator of operators) {
    groups.push(
      ...groupsFor(admit(operator.keyFacts), {
        id: operator.id,
        name: operator.name,
      }),
    );
  }

  return groups;
}
