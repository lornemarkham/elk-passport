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
export type ExperienceKind =
  | "Place"
  | "Organization"
  | "Activity"
  | "Event"
  /**
   * Atlas materialises an `Experience` — a single offering such as a
   * production, a dinner show or a session — and eight of them already flow
   * through this union from `/discovery/candidates`. Leaving it out did not
   * keep them away; it only meant the type disagreed with the data.
   */
  | "Experience";

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
  /** Other names Atlas holds for this thing. Search matches them exactly as it matches `title`; nothing renders them. */
  aliases?: readonly string[];
  shortDescription: string;
  description?: string;

  /** The source's own word for what this is. Never normalised. */
  subtype?: string;
  /** Absent unless Atlas holds a containment edge for it. */
  context?: ExperienceContext;
  /** Whether Atlas holds enough for this to carry its own page — never an eligibility gate. */
  detailReady: boolean;
  /** How many things Atlas says this physically contains. A signal that there is more here, not a navigation tree. */
  containsCount?: number;

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
  /**
   * **Events only**, straight from Atlas, ISO 8601 UTC. Absent on every other
   * kind — Atlas treats them as timeless, and a null date on a park would be a
   * claim it never made.
   *
   * Rendered in `America/Vancouver`: everything Atlas holds is in one timezone,
   * and `Event.startTime` is a `Date` there, so the publisher's own offset is
   * already gone by the time it arrives. Known debt, recorded in Atlas.
   */
  startTime?: string;
  endTime?: string;
  /**
   * The regions Atlas has placed this in — **exactly** what Atlas served, never
   * synthesized and never defaulted. Empty means Atlas has placed it in no
   * region, which is true of most of the corpus and must not be read as
   * "belongs to whichever region is active". See `domain/discovery/regionScope`.
   */
  regionIds: readonly string[];

  familyFriendly: boolean;
  petFriendly: boolean;
  accessible?: boolean;
  requiresReservation: boolean;

  location?: ExperienceLocation;
  pairsWith?: string[];

  isActive: boolean;
}
