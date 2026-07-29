/**
 * Canonical filter state (IMP-002). Discovery's manual filter UI is the
 * first writer of this shape; Mood Board narrowing, Planner inputs, and
 * eventually Atlas conversational/voice filtering are all expected to
 * produce and consume the same shape rather than inventing their own.
 */
export interface DiscoveryFilterState {
  moods: string[];
  activities: string[];
  seasons: string[];
  timeOfDay: string[];
  weather: string[];
  companions: string[];

  maxEnergyLevel?: number;
  maxPriceLevel?: number;
  maxDurationMinutes?: number;

  familyFriendly?: boolean;
  petFriendly?: boolean;
  accessible?: boolean;
  requiresReservation?: boolean;

  radiusKm?: number;
  origin?: {
    latitude: number;
    longitude: number;
  };
}

/** An empty filter state restricts nothing — every active experience matches. */
export function createEmptyFilterState(): DiscoveryFilterState {
  return {
    moods: [],
    activities: [],
    seasons: [],
    timeOfDay: [],
    weather: [],
    companions: [],
  };
}
