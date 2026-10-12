import "server-only";
import { listDiscoveryCandidates, listPlaces } from "@/lib/data/atlas-repo";

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
  const wanted = new Set(refs);
  if (wanted.size === 0) return {};

  const [places, candidates] = await Promise.all([
    listPlaces().catch(() => []),
    listDiscoveryCandidates().catch(() => []),
  ]);

  const names: Record<string, string> = {};
  for (const place of places) {
    if (wanted.has(place.id)) names[place.id] = place.name;
  }
  for (const candidate of candidates) {
    if (wanted.has(candidate.id)) names[candidate.id] = candidate.name;
  }
  return names;
}
