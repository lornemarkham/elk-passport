import "server-only";
import type { SectionType } from "./composition";

/**
 * Turns what Atlas knows into what a traveller sees — and, just as
 * importantly, into what is *missing*.
 *
 * ## Gaps are the second product
 *
 * A section with no data used to disappear. Here it becomes a
 * `PageSection` with `state: "missing"` and a named action: *"No menu
 * yet — Research menu"*. That is the difference between a page that looks
 * finished because it is hiding its holes, and a page that tells a curator
 * what to do next.
 *
 * The rule this follows is the one Region Health already follows: **a
 * visible gap beats a hidden one.** Here it goes further — a visible gap
 * becomes work.
 *
 * ## Nothing is invented
 *
 * Every value below is read from Atlas. Where Atlas holds nothing, the
 * section says so. No placeholder prose, no "coming soon" filler, no
 * inferred hours. A page that quietly makes something up is worse than a
 * page with an obvious hole, because only one of them can be fixed.
 */

export interface EntityKnowledge {
  readonly id: string;
  readonly kind: string;
  readonly name: string;
  readonly description?: string;
  readonly organizationType?: string;
  readonly placeType?: string;
  readonly imageUrl?: string;
  readonly hours?: string;
  readonly address?: string;
  /** Events only. ISO 8601, as Atlas stores the instant. */
  readonly startTime?: string;
  readonly endTime?: string;
  /**
   * Whether the publisher stated a clock or only a date (Atlas
   * `Event.timePrecision`). Absent means Atlas does not know, and the date is
   * read exactly as it was before this field existed — see `statedDay`.
   */
  readonly timePrecision?: "day" | "minute";
  readonly geometry?: { type?: string; coordinates?: number[] };
  readonly externalIds?: readonly { system: string; id: string }[];
  readonly keyFacts?: readonly {
    label: string;
    value: string;
    category?: string;
  }[];
  readonly activities?: readonly string[];
  readonly facilities?: readonly string[];
}

export interface RelatedEntity {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly relationship: string;
}

export interface SourceSummary {
  readonly id: string;
  readonly sourceType: string;
  readonly url: string;
  readonly retrievedAt: string;
}

export type SectionState = "present" | "missing";

export interface PageSection {
  readonly type: SectionType;
  readonly title: string;
  readonly state: SectionState;
  /** Rendered when present. Shape depends on `type`; components narrow it. */
  readonly data?: unknown;
  /** Shown when missing — what's absent and what would fix it. */
  readonly missingLabel?: string;
  readonly action?: string;
}

export interface PassportPage {
  readonly entity: EntityKnowledge;
  readonly heroImageUrl?: string;
  readonly heroCandidates: readonly string[];
  readonly sections: readonly PageSection[];
  readonly completeness: number;
}

export interface BuildInput {
  readonly entity: EntityKnowledge;
  readonly related: readonly RelatedEntity[];
  readonly sources: readonly SourceSummary[];
  readonly order: readonly SectionType[];
  readonly chosenHeroUrl?: string;
}

export function buildPassportPage(input: BuildInput): PassportPage {
  const { entity, related, sources, order } = input;

  // Every image Atlas holds for this entity, so "choose a hero" offers real
  // options rather than an upload box. The entity's own image first.
  const heroCandidates = [
    ...(entity.imageUrl ? [entity.imageUrl] : []),
    ...(entity.keyFacts
      ?.filter((f) => /^https?:\/\/\S+\.(jpg|jpeg|png|webp)/i.test(f.value))
      .map((f) => f.value) ?? []),
  ].filter((url, i, all) => all.indexOf(url) === i);

  const firstParty = entity.externalIds?.find(
    (e) => e.system === "first-party-url",
  );
  const phone = entity.keyFacts?.find(
    (f) =>
      /phone|call/i.test(f.label) ||
      /^\D*\(?\d{3}\)?[\s.-]?\d{3}/.test(f.value),
  );
  const dining = entity.keyFacts?.filter((f) =>
    /breakfast|lunch|dinner|evening|menu|dish|food|coffee|bar/i.test(
      `${f.label} ${f.category ?? ""}`,
    ),
  );
  const nearby = related.filter(
    (r) => r.relationship === "contains" || r.relationship === "near",
  );

  const build = (type: SectionType): PageSection => {
    switch (type) {
      case "hero":
        return present(
          type,
          "Hero",
          {
            imageUrl: input.chosenHeroUrl ?? entity.imageUrl,
            name: entity.name,
          },
          !!(input.chosenHeroUrl ?? entity.imageUrl),
          "No hero image yet",
          "Find a photograph",
        );

      case "overview":
        return present(
          type,
          "Overview",
          { text: entity.description },
          !!entity.description && entity.description.length > 40,
          "No real description yet",
          "Learn from the official site",
        );

      case "hours":
        return present(
          type,
          "Hours",
          { text: entity.hours },
          !!entity.hours,
          "No opening hours yet",
          "Research hours",
        );

      case "contact":
        return present(
          type,
          "Contact",
          { phone: phone?.value, website: firstParty?.id },
          !!(phone || firstParty),
          "No phone or website yet",
          "Find contact details",
        );

      case "dining":
        return present(
          type,
          "What to expect",
          { facts: dining },
          (dining?.length ?? 0) > 0,
          "Nothing known about the food yet",
          "Research the menu",
        );

      case "location":
        return present(
          type,
          "Finding it",
          {
            address: entity.address,
            hasCoordinates: entity.geometry?.type === "Point",
          },
          !!entity.address,
          "No address or coordinates yet",
          "Add a mappable location",
        );

      case "nearby":
        return present(
          type,
          "Nearby",
          { related: nearby },
          nearby.length > 0,
          "Nothing connected yet",
          "Discover what's nearby",
        );

      case "gallery":
        return present(
          type,
          "Gallery",
          { images: heroCandidates.slice(1) },
          heroCandidates.length > 1,
          "Only one photograph",
          "Find more images",
        );

      case "menu":
        return present(type, "Menu", {}, false, "No menu yet", "Research menu");

      case "accessibility":
        return present(
          type,
          "Accessibility",
          {},
          false,
          "Nothing known about accessibility",
          "Research accessibility",
        );

      case "planning":
        return present(
          type,
          "Planning",
          { facilities: entity.facilities, activities: entity.activities },
          (entity.facilities?.length ?? 0) + (entity.activities?.length ?? 0) >
            0,
          "No planning information yet",
          "Research facilities",
        );

      case "sources":
        return present(
          type,
          "Where this comes from",
          { sources },
          sources.length > 0,
          "No sources linked",
          "Teach Atlas about this",
        );
    }
  };

  const sections = order.map(build);
  const present_ = sections.filter((s) => s.state === "present").length;

  return {
    entity,
    heroImageUrl: input.chosenHeroUrl ?? entity.imageUrl,
    heroCandidates,
    sections,
    completeness:
      sections.length === 0
        ? 0
        : Math.round((present_ / sections.length) * 100),
  };
}

function present(
  type: SectionType,
  title: string,
  data: unknown,
  hasData: boolean,
  missingLabel: string,
  action: string,
): PageSection {
  return hasData
    ? { type, title, state: "present", data }
    : { type, title, state: "missing", missingLabel, action };
}
