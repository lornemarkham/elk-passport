import "server-only";
import { VANCOUVER_PLACES } from "@/domain/collections/vancouver";
import type { ConferenceSummary } from "@/domain/conference/contracts";
import {
  anchorsFrom,
  atlasFacts,
  curatedFacts,
  explore,
  type ExplorePlace,
} from "@/domain/conference-explore/explore";
import type { ExploreShelf } from "@/domain/conference-plans/types";
import type { PlaceLookup } from "@/domain/conference-plans/views";
import { townById } from "@/domain/discovery/towns";
import { listDiscoveryCandidates } from "@/lib/data/atlas-repo";
import type { DiscoveryCandidate } from "@/lib/data/types";

/**
 * **Places for the conference modules, from Atlas and the curated list.**
 *
 * One read of Discovery's corpus (cached by `atlas-repo`), bounded in time:
 * a plan page should not wait seven seconds for Atlas to say what a
 * restaurant is called. Past the budget, places show by the name the person
 * saw when they picked it, and curated places still have everything.
 */

export interface Corpus {
  readonly candidates: readonly DiscoveryCandidate[];
  /** Set when Atlas didn't answer in time or at all. */
  readonly outage?: "slow" | "unreachable";
}

export async function corpus(budgetMs = 2500): Promise<Corpus> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const slow = new Promise<Corpus>((resolve) => {
    timer = setTimeout(
      () => resolve({ candidates: [], outage: "slow" }),
      budgetMs,
    );
  });
  const read = listDiscoveryCandidates()
    .then((candidates): Corpus => ({ candidates }))
    .catch((): Corpus => ({ candidates: [], outage: "unreachable" }));
  try {
    return await Promise.race([read, slow]);
  } finally {
    clearTimeout(timer);
  }
}

/** The curated places for a conference's town. Only Vancouver has a list. */
export const curatedFor = (c: Pick<ConferenceSummary, "place">) =>
  c.place.townId === "vancouver" ? VANCOUVER_PLACES : [];

export function lookupFrom(
  c: Pick<ConferenceSummary, "place">,
  candidates: readonly DiscoveryCandidate[],
): PlaceLookup {
  const curated = new Map(curatedFor(c).map((p) => [p.id, p]));
  const atlas = new Map(candidates.map((x) => [x.id, x]));
  return (id) => {
    const p = curated.get(id);
    if (p) {
      // A curated place Atlas now holds is Atlas's (collections/places.ts).
      const held = p.atlasId ? atlas.get(p.atlasId) : undefined;
      return held ? atlasFacts(held) : curatedFacts(p);
    }
    const a = atlas.get(id);
    return a ? atlasFacts(a) : null;
  };
}

export interface Anchor {
  readonly id: string;
  readonly name: string;
  readonly at: readonly [number, number];
}

/** Where Explore measures from: a chosen curated place, else the conference's venue, else the town. */
export function anchorsFor(c: Pick<ConferenceSummary, "place">): Anchor[] {
  const town = c.place.townId ? townById(c.place.townId) : undefined;
  const list = anchorsFrom(curatedFor(c));
  // The convention centre leads where there is one: it is where people are.
  list.sort(
    (a, b) =>
      Number(/convention centre west/i.test(b.name)) -
      Number(/convention centre west/i.test(a.name)),
  );
  if (town)
    list.push({
      id: `town:${town.id}`,
      name: `${town.name} centre`,
      at: [town.latitude, town.longitude],
    });
  return list;
}

export interface ExploreView {
  readonly anchor: Anchor | null;
  readonly anchors: readonly Anchor[];
  readonly shelves: Record<ExploreShelf, ExplorePlace[]>;
  readonly outage?: Corpus["outage"];
}

export async function exploreFor(
  c: Pick<ConferenceSummary, "place">,
  anchorId?: string,
  around?: readonly [number, number],
): Promise<ExploreView> {
  const anchors = anchorsFor(c);
  const anchor = around
    ? { id: "here", name: "where you are", at: around }
    : (anchors.find((a) => a.id === anchorId) ?? anchors[0] ?? null);
  const empty = {
    restaurants: [],
    coffee: [],
    drinks: [],
    waterfront: [],
    sights: [],
    together: [],
  } as Record<ExploreShelf, ExplorePlace[]>;
  if (!anchor) return { anchor: null, anchors, shelves: empty };
  const { candidates, outage } = await corpus(8000);
  return {
    anchor,
    anchors,
    shelves: explore(candidates, curatedFor(c), anchor.at),
    ...(outage ? { outage } : {}),
  };
}
