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
 * the experience is. See `docs/passport-vision.md` for the full three-tier
 * system this maps to (Living AI Scenes / Interactive Magic / Authentic
 * Photography).
 */
export type ExperienceTier = 1 | 2 | 3;

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

export interface Experience {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  description?: string;

  tier: ExperienceTier;
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
