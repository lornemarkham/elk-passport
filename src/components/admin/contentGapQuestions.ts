import type {
  CompletenessDimension,
  DimensionScore,
} from "@/lib/data/admin-repo";

/**
 * Content Gap Analysis (Sprint 1) — translates a missing field into the
 * real question a traveler would actually be asking, instead of a raw
 * field name. `Parking = null` reads like a database row; "Can a
 * traveler determine where to park?" reads like the actual gap.
 *
 * Keyed by field name, not by entity kind, on purpose: every field this
 * maps today (`comparableFields`'s Place-shaped set, see
 * `CompletenessScore.ts` in Atlas) only exists on `Place` right now, so a
 * per-kind table would just be a longer way of writing the same thing.
 * Worth revisiting the day a second kind grows its own comparable fields
 * — the same caveat `CompletenessScore.ts` already documents for its own
 * field lists.
 */
const GAP_QUESTIONS: Record<string, string> = {
  aliases:
    "Would a traveler recognize this by another name they might actually search for?",
  address:
    "Can a traveler find this from a street address, not just a map pin?",
  externalIds:
    "Is this linked to its official record, so Atlas catches official updates automatically?",
  imageUrl:
    "Does a traveler get to see what this actually looks like before deciding to go?",
  hasActiveFireBan:
    "Can a traveler tell whether a campfire is currently allowed here?",
  activities: "Can a traveler tell what there actually is to do here?",
  facilities:
    "Can a traveler tell what's actually on site — washrooms, water, parking?",
  hours: "Can a traveler tell when this is actually open?",
  wheelchairAccessible:
    "Can a traveler tell whether this is wheelchair accessible?",
  feeRequired: "Can a traveler tell whether they'll need to pay to get in?",
};

const DIMENSION_FALLBACK_QUESTIONS: Record<CompletenessDimension, string> = {
  identity:
    "Would a traveler (or Atlas itself) recognize this as the same real place across different sources?",
  visual: "Does a traveler get to see what this actually looks like?",
  sources:
    "Has more than one independent source confirmed what Atlas knows about this?",
  relationships:
    "Does Atlas know what's actually near this — could it ever recommend the two together?",
  travelerInfo:
    "Does Atlas know the practical details a traveler would ask about before going?",
};

/** A gap question for one missing field — the field-specific question if one exists, otherwise the dimension's honest fallback. */
export function gapQuestionForField(
  field: string,
  dimension: CompletenessDimension,
): string {
  return GAP_QUESTIONS[field] ?? DIMENSION_FALLBACK_QUESTIONS[dimension];
}

/** Every real gap question a `DimensionScore` implies — empty if the dimension is already complete or not applicable (`percent` is `100` or `null`). */
export function gapQuestionsForDimension(dimension: DimensionScore): string[] {
  if (dimension.percent === null || dimension.percent === 100) return [];
  if (dimension.missingFields.length > 0) {
    return dimension.missingFields.map((field) =>
      gapQuestionForField(field, dimension.dimension),
    );
  }
  // Sources/Relationships aren't field-based — one dimension-level question stands in for "this isn't there yet."
  return [DIMENSION_FALLBACK_QUESTIONS[dimension.dimension]];
}
