import type { Experience, ExperienceKind } from "@/domain/experience/types";

/**
 * **Which candidates lead the Discover page — a Passport product policy, not
 * Atlas truth.**
 *
 * Atlas answers *"does Atlas know enough about this to be considered?"* and says
 * yes to 189 things. That is not the same question as *"should this be one of
 * the first things a traveller is shown?"*, and collapsing the two turned the
 * page into a database dump: a typo'd parking lot was the second result, an
 * OpenStreetMap way id was the third.
 *
 * Nothing here is persisted, nothing is written back to Atlas, and every
 * excluded candidate stays fully searchable. There is deliberately no
 * `discoverable`, `featured`, `tier`, `feedEligible`, score or rank — the four
 * rules below read only facts Atlas already states.
 *
 * **This is not ranking.** It decides membership, never order.
 */
export type FeedExclusion =
  | "generic-activity"
  | "infrastructure-or-institution"
  | "unclassified-and-thin"
  | "activity-without-substance";

/**
 * Subtypes that describe how a place works rather than somewhere to go.
 *
 * Deliberately small, explicit and closed — this is not a tourism taxonomy, and
 * it must not grow into one. Each entry is a subtype Atlas actually holds, and
 * every excluded record stays searchable, because "not the first thing to show
 * a traveller" is a very different claim from "not worth knowing".
 *
 * Measured against the live corpus: 22 records.
 */
export const NOT_A_DESTINATION_SUBTYPE: ReadonlySet<string> = new Set([
  // Infrastructure — real, mapped, and not somewhere you set out for.
  "parking",
  "public washroom",
  "washroom facilities",
  "road",
  // Administrative geography — scope and navigation, not a discovery.
  "region",
  "city",
  // Institutions — organisations that exist, but not as places to visit.
  "government",
  "government agency",
  "military training centre",
  "transit system",
  "trust",
  "sports team",
  "educational institution",
  "company",
]);

export const normaliseSubtype = (value: string | undefined): string =>
  (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Whether Atlas holds anything about this beyond a sentence describing it.
 *
 * Deliberately three existing facts, unweighted and equal: a photograph the
 * source published, a containment edge Atlas asserted, or things it contains.
 * Any one is enough.
 *
 * It is **not** a quality score and **not** a stand-in for media. It is only
 * consulted where a candidate cannot otherwise say what it is — an unclassified
 * record, or an Activity, which is a category rather than a specific thing.
 * A classified Place never faces this test, which is why `Kekuli Bay Provincial
 * Park` stays in the feed with no photograph at all.
 */
function hasSubstanceBeyondDescription(experience: Experience): boolean {
  return (
    Boolean(experience.heroMedia) ||
    Boolean(experience.context) ||
    (experience.containsCount ?? 0) > 0
  );
}

/**
 * Why this candidate is not in the default feed, or `undefined` if it is.
 *
 * Order matters only for reporting — the first matching reason is the one
 * given, so a record is counted once rather than under every rule it meets.
 */
export function feedExclusion(
  experience: Experience,
): FeedExclusion | undefined {
  const subtype = normaliseSubtype(experience.subtype);

  // A · A generic concept, structurally: the Activity's name *is* its own type.
  // `Snowboarding` of type `Snowboarding`, `camping` of type `camping`. These
  // are correct Atlas knowledge and useful for search and composition; they are
  // not a thing to go and do tonight. Derived, never a name list.
  if (
    experience.kind === "Activity" &&
    subtype.length > 0 &&
    subtype === normaliseSubtype(experience.title)
  ) {
    return "generic-activity";
  }

  // B · Infrastructure and institutions, by the source's own subtype.
  if (NOT_A_DESTINATION_SUBTYPE.has(subtype)) {
    return "infrastructure-or-institution";
  }

  // C · `unknown` is incomplete classification, never a verdict. `Big White`
  // carries 21 photographs and `Rhonda Lake` 11, both unclassified, and both
  // belong in the feed. So an unclassified record is asked only whether Atlas
  // holds anything else about it — no named exceptions, either way.
  if (subtype === "unknown" && !hasSubstanceBeyondDescription(experience)) {
    return "unclassified-and-thin";
  }

  // D · An Activity that is specific but bare. `night skiing` is a real
  // candidate with a real description and nothing else: no photograph, no place
  // Atlas can say it happens at, nowhere to go. It is a candidate waiting for
  // context rather than something to lead with — and it stays searchable.
  if (
    experience.kind === "Activity" &&
    !hasSubstanceBeyondDescription(experience)
  ) {
    return "activity-without-substance";
  }

  return undefined;
}

/** The conservative default view. Order is untouched — this decides membership only. */
export function defaultFeed(experiences: readonly Experience[]): Experience[] {
  return experiences.filter(
    (experience) => feedExclusion(experience) === undefined,
  );
}

/** Kinds present in the full candidate corpus, for the browse control. */
export function availableKinds(
  experiences: readonly Experience[],
): ExperienceKind[] {
  const order: ExperienceKind[] = [
    "Place",
    "Organization",
    "Activity",
    "Event",
  ];
  const present = new Set(experiences.map((experience) => experience.kind));
  return order.filter((kind) => present.has(kind));
}

/** Plain-language name for a kind. Passport's words, not Atlas's type names. */
export function kindLabel(kind: ExperienceKind): string {
  switch (kind) {
    case "Place":
      return "Places";
    case "Organization":
      return "Food & business";
    case "Activity":
      return "Things to do";
    case "Event":
      return "Events";
  }
}
