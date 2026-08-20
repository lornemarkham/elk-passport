import type { EntityLike } from "./regionHealth";

/**
 * **Could Passport show this to a traveller today?**
 *
 * Atlas completeness and Passport readiness are different questions, and
 * conflating them is how a corpus grows without the product improving. Atlas
 * can ingest a lake with provenance, corroboration and a canonical identifier
 * and still have nothing worth putting on a page — no picture, no sentence, no
 * pin on a map.
 *
 * So this asks one narrow question: **does this entity have the fields the
 * traveller-facing page actually renders?**
 *
 * ## Why these four, and not a score
 *
 * Every requirement below is a field `app/src/lib/knowledge/passportUsage.ts`
 * records as being read by a real Passport section. Nothing is weighted,
 * nothing is averaged, and there is no percentage: an entity either has what
 * the page needs or it is missing something nameable. *Needs enrichment* is
 * always accompanied by the list of what is missing, because "72% ready" tells
 * an operator nothing they can act on and "needs a picture" tells them
 * everything.
 *
 * ## Why the list is declared here rather than imported
 *
 * `passportUsage.ts` is the authority on what Passport renders, and the
 * honest thing would be to derive this from it. It cannot be imported here:
 * that module imports `PLACE_SECTIONS`, which imports the entire traveller
 * page component tree, and pulling that into an admin server component to read
 * four field names is a real cost for a cosmetic gain.
 *
 * The mitigation is the one `passportUsage.ts` uses for its own hand-maintained
 * table — say so. Each requirement quotes the sections that read it, the UI
 * states that this list is maintained alongside `passportUsage.ts`, and the
 * fields chosen are the four whose usage is unambiguous rather than the full
 * table.
 *
 * ## What this deliberately does not measure
 *
 * **Evidence.** Whether an entity traces to its operator's own website, and
 * whether two publishers agree about it, is a different question with its own
 * instrument (`evidenceReading` in `missionHealth.ts`). A place can be
 * beautifully sourced and unpresentable, or presentable and thinly sourced.
 * Folding both into one verdict would produce exactly the weighted score ADR
 * 042 refuses.
 */

export interface PassportRequirement {
  readonly key: string;
  /** Imperative and concrete — what an operator would go and get. */
  readonly label: string;
  /** Which traveller-facing sections read it. Quoted from `passportUsage.ts`. */
  readonly renders: string;
  /** Places only, or every kind. */
  readonly placeOnly?: boolean;
  readonly satisfied: (entity: EntityLike) => boolean;
}

const hasText = (value: unknown): boolean =>
  typeof value === "string" && value.trim().length > 0;

const hasPoint = (entity: EntityLike): boolean => {
  const geometry = entity.geometry;
  return (
    geometry?.type === "Point" &&
    Array.isArray(geometry.coordinates) &&
    geometry.coordinates.length === 2
  );
};

export const PASSPORT_REQUIREMENTS: readonly PassportRequirement[] = [
  {
    key: "name",
    label: "A name",
    renders: "The page title and the hero heading.",
    satisfied: (e) => hasText(e.name),
  },
  {
    key: "description",
    label: "A description",
    renders:
      "Rendered in full under Overview, and its first sentence may seed “What do I do first?”. Without it the page has no prose at all.",
    satisfied: (e) => hasText(e.description),
  },
  {
    key: "image",
    label: "A picture",
    renders: "The hero image and the “Don’t leave without…” block.",
    satisfied: (e) => hasText(e.imageUrl),
  },
  {
    key: "location",
    label: "A location",
    renders: "The map pin and Quick Facts.",
    placeOnly: true,
    satisfied: hasPoint,
  },
];

/**
 * Requirements that apply to this entity.
 *
 * An Organization is not a location (ADR 019), so grading one for missing
 * coordinates would penalise correct modelling — the same reasoning
 * `regionHealth.completenessOf` already applies.
 */
export function requirementsFor(
  entity: EntityLike,
): readonly PassportRequirement[] {
  return PASSPORT_REQUIREMENTS.filter(
    (r) => !r.placeOnly || entity.kind === "Place",
  );
}

export interface EntityReadiness {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly ready: boolean;
  /** Empty when ready. Never a count on its own — an operator needs the names. */
  readonly missing: readonly PassportRequirement[];
}

export function entityReadiness(entity: EntityLike): EntityReadiness {
  const missing = requirementsFor(entity).filter((r) => !r.satisfied(entity));
  return {
    id: entity.id,
    name: entity.name ?? "Unnamed",
    kind: entity.kind,
    ready: missing.length === 0,
    missing,
  };
}

/** One missing requirement, across the mission. The operator's shopping list. */
export interface ReadinessGap {
  readonly key: string;
  readonly label: string;
  readonly renders: string;
  readonly count: number;
  /** Real entities, named. Counts abstract; names are what a person acts on. */
  readonly examples: readonly string[];
}

export interface PassportReadiness {
  readonly total: number;
  readonly ready: number;
  readonly needsEnrichment: number;
  readonly entities: readonly EntityReadiness[];
  /** Largest gap first. */
  readonly gaps: readonly ReadinessGap[];
  /** Named, so the section is about places rather than about arithmetic. */
  readonly readyExamples: readonly string[];
  readonly needsExamples: readonly EntityReadiness[];
}

const EXAMPLE_LIMIT = 6;

export function passportReadiness(
  scoped: readonly EntityLike[],
): PassportReadiness | null {
  if (scoped.length === 0) return null;

  const entities = scoped.map(entityReadiness);
  const ready = entities.filter((e) => e.ready);
  const needs = entities.filter((e) => !e.ready);

  const gaps: ReadinessGap[] = PASSPORT_REQUIREMENTS.map((requirement) => {
    const lacking = needs.filter((e) =>
      e.missing.some((m) => m.key === requirement.key),
    );
    return {
      key: requirement.key,
      label: requirement.label,
      renders: requirement.renders,
      count: lacking.length,
      examples: lacking.slice(0, 3).map((e) => e.name),
    };
  })
    .filter((gap) => gap.count > 0)
    .sort((a, b) => b.count - a.count);

  return {
    total: entities.length,
    ready: ready.length,
    needsEnrichment: needs.length,
    entities,
    gaps,
    readyExamples: ready.slice(0, EXAMPLE_LIMIT).map((e) => e.name),
    // Fewest gaps first: the entities closest to being presentable are the
    // cheapest work, and an operator with ten minutes should see those.
    needsExamples: [...needs]
      .sort((a, b) => a.missing.length - b.missing.length)
      .slice(0, EXAMPLE_LIMIT),
  };
}
