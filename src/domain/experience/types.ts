/**
 * Canonical Experience domain model (IMP-002).
 *
 * This is the shared contract every future consumer — Discovery, Mood
 * Board, Planner, Atlas text/voice, search, recommendation systems —
 * filters and reasons over. It must stay free of UI layout, animation, or
 * presentation concerns; those live alongside whatever renders a given
 * surface (see `src/components/labs/discovery-space/fieldPresentation.ts`
 * for Discovery's own presentational layer).
 */

/**
 * How alive an experience's presentation should feel — not how important
 * the experience is.
 * system this maps to (Living AI Scenes / Interactive Magic / Authentic
 * Photography).
 */
/** 0 = free, 4 = highest price bracket. Ordinal, not a currency amount. */
export type PriceLevel = 0 | 1 | 2 | 3 | 4;

/** 1 = lowest exertion, 5 = highest. */
export type EnergyLevel = 1 | 2 | 3 | 4 | 5;

export interface ExperienceLocation {
  name: string;
  latitude?: number;
  longitude?: number;
  region?: string;
}

export interface ExperienceDuration {
  minMinutes: number;
  maxMinutes: number;
}

export interface ExperienceMedia {
  type: "video" | "image" | "animation";
  src: string;
  posterSrc?: string;
  alt?: string;
}

/**
 * Which kind of Atlas entity this presents. An Experience is no longer a
 * synonym for a Place: `The BullWheel` is an Organization with 49 photographs
 * and a real containment edge from Big White, and it was invisible to Discover
 * for exactly as long as this model assumed Place.
 */
export type ExperienceKind = "Place" | "Organization" | "Activity" | "Event";

/**
 * What physically contains this, one hop, derived by Atlas from a non-region
 * `contains` edge. Present only when Atlas actually holds that edge — the label
 * "at Big White" must never be inferred from a name or a coordinate.
 */
export interface ExperienceContext {
  id: string;
  kind: ExperienceKind;
  name: string;
}

export interface Experience {
  id: string;
  kind: ExperienceKind;
  slug: string;
  title: string;
  shortDescription: string;
  description?: string;

  /** The source's own word for what this is. Never normalised. */
  subtype?: string;
  /** Absent unless Atlas holds a containment edge for it. */
  context?: ExperienceContext;
  /** Whether Atlas holds enough for this to carry its own page — never an eligibility gate. */
  detailReady: boolean;

  heroMedia?: ExperienceMedia;

  moods: string[];
  activities: string[];
  seasons: string[];
  timeOfDay: string[];
  weather: string[];
  companions: string[];

  energyLevel: EnergyLevel;
  priceLevel: PriceLevel;
  duration: ExperienceDuration;

  familyFriendly: boolean;
  petFriendly: boolean;
  accessible?: boolean;
  requiresReservation: boolean;

  location?: ExperienceLocation;
  pairsWith?: string[];

  isActive: boolean;
}
