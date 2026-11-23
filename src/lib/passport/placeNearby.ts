import { listDiscoveryCandidates } from "@/lib/data/atlas-repo";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import { forDiscoveryPool } from "@/domain/discovery/hygiene";
import { nearbyLinks } from "@/domain/place-details/nearby";
import type { PlaceLink } from "@/domain/place-details/model";

/**
 * Close-by places for a place page, from the cached corpus read Discovery
 * itself uses — so the shelf shows what a card would, and costs no extra
 * Atlas request once Discovery has been visited. A failed read is an empty
 * shelf, never a failed page.
 */
export async function nearbyFor(
  at: { readonly latitude: number; readonly longitude: number } | undefined,
  selfId: string,
): Promise<PlaceLink[]> {
  if (!at) return [];
  try {
    const candidates = await listDiscoveryCandidates();
    const pool = forDiscoveryPool(
      candidates.map(candidateToExperience),
      new Date(),
    );
    return nearbyLinks(pool, at, selfId);
  } catch {
    return [];
  }
}
