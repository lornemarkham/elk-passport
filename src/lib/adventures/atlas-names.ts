import "server-only";
import { listDiscoveryCandidates, listPlaces } from "@/lib/data/atlas-repo";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import type { Experience } from "@/domain/experience/types";

/**
 * **What Atlas calls the things a plan points at.**
 *
 * An item holds only an Atlas id; the name is Atlas's and is read, never
 * copied into Passport. Same two reads the board page resolves its items
 * with, so a plan and a board name a thing identically. Either may be down:
 * whatever answers names what it can, and the page says the rest can't be
 * named right now rather than inventing a name.
 */
export async function atlasNamesFor(
  refs: readonly string[],
): Promise<Record<string, string>> {
  const { names } = await atlasStopsFor(refs);
  return names;
}

export interface AtlasStops {
  /** Every ref Atlas could name, by id. */
  readonly names: Record<string, string>;
  /**
   * The Discovery possibility for each ref the candidates feed holds — the
   * same `Experience` Discovery and Saved render, with Atlas's coordinates,
   * picture and dates — so a plan shows the card a person saved, and the
   * Day Builder's travel legs can be asked between them.
   */
  readonly experiences: Record<string, Experience>;
}

/** Names for every ref, and the possibility for those Discovery offers. */
export async function atlasStopsFor(
  refs: readonly string[],
): Promise<AtlasStops> {
  const wanted = new Set(refs);
  if (wanted.size === 0) return { names: {}, experiences: {} };

  const [places, candidates] = await Promise.all([
    listPlaces().catch(() => []),
    listDiscoveryCandidates().catch(() => []),
  ]);

  const names: Record<string, string> = {};
  const experiences: Record<string, Experience> = {};
  for (const place of places) {
    if (wanted.has(place.id)) names[place.id] = place.name;
  }
  for (const candidate of candidates) {
    if (!wanted.has(candidate.id)) continue;
    names[candidate.id] = candidate.name;
    experiences[candidate.id] = candidateToExperience(candidate);
  }
  return { names, experiences };
}
