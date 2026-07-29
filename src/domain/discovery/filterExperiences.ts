import type { Experience } from "@/domain/experience/types";
import type { DiscoveryFilterState } from "./types";

/**
 * True when `selected` is empty (an empty category never restricts
 * results) or shares at least one value with `values` (OR within a
 * category — rule 3/4, IMP-002 §8).
 */
function matchesCategory(values: string[], selected: string[]): boolean {
  if (selected.length === 0) return true;
  return values.some((value) => selected.includes(value));
}

/**
 * Pure Compass filtering function (IMP-002 §8). Every consumer — Discovery,
 * Mood Board, Planner, Atlas text/voice — is expected to call this same
 * function rather than reimplementing filtering rules. Never mutates
 * `experiences` or `filters` (rule 9); preserves source order (rule 10).
 */
export function filterExperiences(
  experiences: Experience[],
  filters: DiscoveryFilterState,
): Experience[] {
  return experiences.filter((experience) => {
    if (!experience.isActive) return false;

    if (!matchesCategory(experience.moods, filters.moods)) return false;
    if (!matchesCategory(experience.activities, filters.activities))
      return false;
    if (!matchesCategory(experience.seasons, filters.seasons)) return false;
    if (!matchesCategory(experience.timeOfDay, filters.timeOfDay)) return false;
    if (!matchesCategory(experience.weather, filters.weather)) return false;
    if (!matchesCategory(experience.companions, filters.companions))
      return false;

    if (
      filters.maxEnergyLevel !== undefined &&
      experience.energyLevel > filters.maxEnergyLevel
    )
      return false;

    if (
      filters.maxPriceLevel !== undefined &&
      experience.priceLevel > filters.maxPriceLevel
    )
      return false;

    if (
      filters.maxDurationMinutes !== undefined &&
      experience.duration.minMinutes > filters.maxDurationMinutes
    )
      return false;

    if (
      filters.familyFriendly !== undefined &&
      experience.familyFriendly !== filters.familyFriendly
    )
      return false;

    if (
      filters.petFriendly !== undefined &&
      experience.petFriendly !== filters.petFriendly
    )
      return false;

    if (
      filters.accessible !== undefined &&
      experience.accessible !== filters.accessible
    )
      return false;

    if (
      filters.requiresReservation !== undefined &&
      experience.requiresReservation !== filters.requiresReservation
    )
      return false;

    return true;
  });
}
