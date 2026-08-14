/**
 * Derived views over `DiscoveryState` + the canonical catalogue. Kept as
 * selectors rather than extra state fields (the IMP-004 spec's suggested
 * `activeExperienceIds` is treated as derived here, not stored) so there is
 * exactly one place that can disagree with itself about what's active.
 */
import type { Experience } from "@/domain/experience/types";
import { filterExperiences } from "./filterExperiences";
import type { DiscoveryState } from "./discoveryState";

/** Exported so any renderer of "does this experience match this free-text
 * query" — Discovery's immersive field, List mode, anywhere else this
 * comes up — calls the same function rather than reimplementing it. */
export function matchesQuery(experience: Experience, query: string): boolean {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;
  const haystack = [
    experience.title,
    experience.shortDescription,
    experience.description ?? "",
    ...experience.moods,
    ...experience.activities,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(trimmed);
}

/**
 * Experiences currently eligible to appear in the active discovery field:
 * pass the shared Compass filters and free-text query, and are not already
 * saved, rejected, or shelved. This is the one function every renderer of
 * "what's active right now" should call.
 */
export function selectActiveExperiences(
  catalogue: Experience[],
  state: DiscoveryState,
): Experience[] {
  const excluded = new Set([
    ...state.savedExperienceIds,
    ...state.rejectedExperienceIds,
    ...state.shelvedExperienceIds,
  ]);

  return filterExperiences(catalogue, state.filters).filter(
    (experience) =>
      !excluded.has(experience.id) && matchesQuery(experience, state.query),
  );
}

export function selectSavedExperiences(
  catalogue: Experience[],
  state: DiscoveryState,
): Experience[] {
  return state.savedExperienceIds
    .map((id) => catalogue.find((experience) => experience.id === id))
    .filter((experience): experience is Experience => Boolean(experience));
}

export function selectShelvedExperiences(
  catalogue: Experience[],
  state: DiscoveryState,
): Experience[] {
  return state.shelvedExperienceIds
    .map((id) => catalogue.find((experience) => experience.id === id))
    .filter((experience): experience is Experience => Boolean(experience));
}
