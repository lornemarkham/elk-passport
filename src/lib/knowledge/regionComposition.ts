import "server-only";
import type { WorkspaceBundle } from "./workspaceData";
import type { RegionScope } from "./regionScope";

/**
 * **Why this region looks small.**
 *
 * ## The finding this exists to explain
 *
 * Atlas holds ~166 entities. The Okanagan contains 7. That looks like a
 * failure and is not one: measured on 2026-08-17 there are **nine
 * `contains` edges in the entire corpus**, and only one of them asserts
 * region membership. Most entities were ingested before Regions existed
 * (ADR 025) and nobody has placed them since.
 *
 * A workspace that shows 7 without saying that is technically accurate
 * and actively misleading — a curator reasonably concludes Atlas lost
 * their data. **A visible gap beats a hidden one**, and this is the gap.
 *
 * ## Three numbers, and what each one means
 *
 * | | |
 * |---|---|
 * | `corpus` | every entity Atlas holds, regions excluded |
 * | `inThisRegion` | this region's scope — members plus what they contain |
 * | `inOtherRegions` | placed somewhere else. Not this region's problem |
 * | `unassigned` | in **no** region. The number that explains the gap |
 *
 * Regions themselves are excluded from `corpus`: a region is a container,
 * and counting it as one of its own contents would inflate every figure.
 *
 * ## Reachability, not direct membership
 *
 * An entity inside Big White *is* in the Okanagan — a curator placed Big
 * White, and a source said Big White contains it. Both are asserted
 * facts. So `unassigned` means **not reachable from any region**, not
 * "has no direct membership edge". Counting the six venues as unassigned
 * would invite a curator to re-place things that are already there.
 *
 * ## Nothing here is inferred
 *
 * No coordinates, no bounding boxes, no name matching. Every number is a
 * count over asserted `contains` edges (ADR 025, ADR 029).
 */

export interface RegionComposition {
  readonly corpus: number;
  readonly inThisRegion: number;
  readonly inOtherRegions: number;
  readonly unassigned: number;
  /** The unassigned entity ids, for the review drawer. */
  readonly unassignedIds: readonly string[];
  /** Other regions that exist, so "elsewhere" is checkable. */
  readonly otherRegionCount: number;
  /** `false` when the corpus could not be read — never rendered as zero. */
  readonly known: boolean;
}

const UNKNOWN: RegionComposition = {
  corpus: 0,
  inThisRegion: 0,
  inOtherRegions: 0,
  unassigned: 0,
  unassignedIds: [],
  otherRegionCount: 0,
  known: false,
};

export function regionComposition(
  scope: RegionScope,
  bundle: WorkspaceBundle | null,
  /** Every region's id and its asserted member ids, from `/admin/regions`. */
  allRegions: readonly {
    readonly id: string;
    readonly memberIds: readonly string[];
  }[],
  thisRegionId: string,
): RegionComposition {
  if (!bundle) return UNKNOWN;

  const regionIds = new Set(allRegions.map((r) => r.id));

  // Children of anything, by parent — one pass, reused for every walk.
  const childrenOf = new Map<string, string[]>();
  for (const r of bundle.relationships) {
    if (r.type !== "contains") continue;
    const list = childrenOf.get(r.sourceEntityId);
    if (list) list.push(r.targetEntityId);
    else childrenOf.set(r.sourceEntityId, [r.targetEntityId]);
  }

  /** Everything reachable from these roots. Visited set: `contains` can cycle. */
  const reach = (roots: readonly string[]): Set<string> => {
    const seen = new Set(roots);
    const queue = [...roots];
    while (queue.length > 0) {
      const id = queue.shift()!;
      for (const child of childrenOf.get(id) ?? []) {
        if (seen.has(child)) continue;
        seen.add(child);
        queue.push(child);
      }
    }
    return seen;
  };

  const placedAnywhere = new Set<string>();
  for (const region of allRegions) {
    for (const id of reach(region.memberIds)) placedAnywhere.add(id);
  }

  const corpusEntities = bundle.entities.filter(
    (e) => !regionIds.has(String(e.id)),
  );

  const unassignedIds = corpusEntities
    .map((e) => String(e.id))
    .filter((id) => !placedAnywhere.has(id));

  const inThisRegion = scope.ids.size;

  return {
    corpus: corpusEntities.length,
    inThisRegion,
    // Placed in some region, but not reachable from this one.
    inOtherRegions: [...placedAnywhere].filter(
      (id) => !scope.ids.has(id) && !regionIds.has(id),
    ).length,
    unassigned: unassignedIds.length,
    unassignedIds,
    otherRegionCount: allRegions.filter((r) => r.id !== thisRegionId).length,
    known: true,
  };
}
