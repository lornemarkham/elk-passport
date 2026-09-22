/**
 * Derived views over `DiscoveryState` + the canonical catalogue. Kept as
 * selectors rather than extra state fields (the IMP-004 spec's suggested
 * `activeExperienceIds` is treated as derived here, not stored) so there is
 * exactly one place that can disagree with itself about what's active.
 */
import type { Experience } from "@/domain/experience/types";
import { filterExperiences } from "./filterExperiences";
import { rankQuery } from "./searchRank";
import type { DiscoveryState } from "./discoveryState";

/**
 * Does this experience match this free-text query at all. One function for
 * every renderer of the question — Discovery's immersive field, List mode,
 * anywhere else. Since M10 the answer comes from `rankQuery`: a match on
 * the name or an alias by token coverage, or the old description substring
 * as the floor. Ordering is `rankByQuery`'s; this is only the yes/no.
 */
export function matchesQuery(experience: Experience, query: string): boolean {
  return rankQuery(experience, query) !== undefined;
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
