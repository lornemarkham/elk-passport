import { PLACE_SECTIONS } from "@/components/place-detail/sections";

/**
 * Which pieces of Atlas knowledge the traveler-facing Passport page
 * actually surfaces today — and, just as importantly, which it does not.
 *
 * **This deliberately lives in `app/`, not in Atlas.** "What does Passport
 * render?" is a Passport fact. Atlas must never learn it: the whole
 * Atlas-is-a-reservoir / Passport-is-a-relevance-engine split
 * (`brand-principles.md`) depends on Atlas storing knowledge without any
 * awareness of which consumer displays it. An `isUsedByPassport` flag
 * living on an Atlas entity would quietly invert that.
 *
 * Maintained as a small declaration rather than derived automatically,
 * because there is no honest way to compute "does this React component
 * read this field" at runtime. The mitigation is that it's checked against
 * the real components (`grep place.<field> components/place-detail`) and
 * the section list below is imported from the real `PLACE_SECTIONS`, so a
 * section being added or removed from the page can't silently desync the
 * count shown in the Workspace header.
 *
 * When this drifts, it under- or over-reports the "known but unused"
 * state. That's a real limitation and is surfaced honestly in the UI
 * rather than presented as certainty.
 */

/** A field's usage: which traveler-facing sections read it, if any. */
export interface FieldUsage {
  /** Section keys from `PLACE_SECTIONS`, plus the two always-on components (`hero`, `fire-ban-notice`) that sit outside that array in `places/[id]/page.tsx`. */
  readonly sections: readonly string[];
  /** Short, human explanation of *how* it's used — shown on hover, so a curator isn't guessing what "used" means. */
  readonly note?: string;
}

/**
 * Verified against the real components on 2026-08-12, after Milestone 0
 * removed `PlaceComeHereIf` and `PlacePerfectDay` and dropped
 * `PlaceActivities` from the rendered page.
 */
const PLACE_FIELD_USAGE: Readonly<Record<string, FieldUsage>> = {
  name: { sections: ["hero"], note: "Page title and hero heading." },
  description: {
    sections: ["overview", "first-thing"],
    note: "Rendered in full under Overview; its first sentence may seed 'What do I do first?'.",
  },
  imageUrl: {
    sections: ["hero", "dont-miss"],
    note: "Hero image and the featured 'Don't leave without…' block.",
  },
  placeType: {
    sections: ["hero", "quick-facts"],
    note: "Shown as the entity's label and under Quick Facts.",
  },
  geometry: {
    sections: ["hero", "quick-facts", "map"],
    note: "Coordinates and the map pin.",
  },
  address: {
    sections: ["hero"],
    note: "Shown in the hero when Atlas has one.",
  },
  activities: {
    sections: ["hero", "dont-miss", "should-i-come"],
    note: "Drives the hero summary line, the 'Don't leave without…' list, and the fit signals behind 'Should I come?'.",
  },
  facilities: {
    sections: ["hero", "practical", "should-i-come"],
    note: "The Facilities row of 'Good to know' (chips), and developed-site fit signals.",
  },
  hours: {
    sections: ["practical"],
    note: "The Hours & season row of 'Good to know', verbatim, dated as of its observation.",
  },
  feeRequired: {
    sections: ["practical", "what-to-bring"],
    note: "The Fees & reservations row of 'Good to know', and informs 'What should I bring?'.",
  },
  wheelchairAccessible: {
    sections: ["practical", "what-to-bring"],
    note: "The Accessibility row of 'Good to know'.",
  },
  hasActiveFireBan: {
    sections: ["fire-ban-notice", "what-to-bring"],
    note: "The one live-condition alert above the fold.",
  },

  // Known to Atlas, deliberately not surfaced anywhere on the traveler page.
  aliases: { sections: [] },
  externalIds: { sections: [] },
  keyFacts: {
    sections: ["practical"],
    note: "Composed by Atlas into the rows of 'Good to know' — hours, fees, getting there, facilities, accessibility, dogs, rules, safety, contact — with the rest under 'More details' verbatim.",
  },
  archivedAt: { sections: [] },
};

/** Non-Place kinds have no dedicated traveler page today — they surface only as related-place cards. Declared explicitly so the Workspace doesn't imply a page exists. */
const NON_PLACE_FIELD_USAGE: Readonly<Record<string, FieldUsage>> = {
  name: {
    sections: ["related-card"],
    note: "Appears on related-entity cards.",
  },
  description: {
    sections: ["related-card"],
    note: "Appears on related-entity cards.",
  },
  imageUrl: {
    sections: ["related-card"],
    note: "Appears on related-entity cards.",
  },
};

export function fieldUsage(entityKind: string, fieldName: string): FieldUsage {
  const table =
    entityKind === "Place" ? PLACE_FIELD_USAGE : NON_PLACE_FIELD_USAGE;
  return table[fieldName] ?? { sections: [] };
}

/**
 * `keyFacts` have no per-fact usage table: every fact reaches the page
 * through one section, "Good to know" (`practical`), composed by Atlas —
 * which row a fact lands in is Atlas's read-model decision
 * (`atlas/src/application/readmodel/practicalKnowledge.ts`), not something
 * this table could state per fact without restating that module. Kept as
 * its own function so the answer stays one obvious place.
 */
export function keyFactUsage(): FieldUsage {
  return PLACE_FIELD_USAGE.keyFacts!;
}

/** Section keys that really exist on the page today — used to sanity-check the table above against reality. */
export const RENDERED_SECTION_KEYS: readonly string[] = [
  "hero",
  "fire-ban-notice",
  ...PLACE_SECTIONS.map((s) => s.key),
];
