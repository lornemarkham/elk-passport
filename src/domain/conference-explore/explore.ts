import { normaliseSubtype } from "@/domain/discovery/defaultFeed";
import { intentByKey } from "@/domain/discovery/intents";
import {
  curatedNear,
  sameName,
  walkMinutesFor,
  type CuratedKind,
  type CuratedPlace,
} from "@/domain/collections/places";
import { nearbyImage, type NearbyImage } from "@/domain/hockey/nearby";
import type { ExploreShelf } from "@/domain/conference-plans/types";
import type { PlaceFacts } from "@/domain/conference-plans/views";
import { distanceKm } from "@/lib/environment/geo";
import type { DiscoveryCandidate } from "@/lib/data/types";

/**
 * **Explore: real places near where the group is, by what a group does.**
 *
 * The candidates are Discovery's own, and every shelf is drawn from Atlas's
 * own subtype words through Discovery's intents (`intents.ts`): nothing here
 * decides a place is a coffee shop that Atlas didn't say was one. Where Atlas
 * holds nothing near (an outage, or a place not yet ingested), the shared
 * curated Vancouver list fills in and says so (`from: "curated"`), the same
 * fallback Hockey Night's dinner vote uses.
 *
 * Pictures follow Passport's one rule, reused from Hockey's ballot
 * (`nearbyImage`): the place's own photograph, its venue's, or its own
 * site's, each labelled — never an illustrative stand-in for the kind of
 * place.
 *
 * Distances are straight lines from the chosen anchor, at walking pace, and
 * the label says so. A place Atlas only placed by its town is not measured.
 */

export interface ExplorePlace extends PlaceFacts {
  readonly shelf: ExploreShelf;
  readonly subtype?: string;
  readonly km: number;
  readonly walkMinutes: number;
  readonly photo?: NearbyImage;
  readonly kind?: DiscoveryCandidate["kind"];
}

export interface ShelfInfo {
  readonly id: ExploreShelf;
  readonly title: string;
  /** What the shelf is, honestly: which of Atlas's words put a place on it. */
  readonly note: string;
}

export const SHELVES: readonly ShelfInfo[] = [
  {
    id: "restaurants",
    title: "Restaurants",
    note: "Kitchens near you, as Atlas lists them.",
  },
  {
    id: "coffee",
    title: "Coffee",
    note: "Cafés, roasters, bakeries and tea houses.",
  },
  { id: "drinks", title: "Drinks", note: "Bars, pubs, breweries, lounges." },
  {
    id: "waterfront",
    title: "Walks & waterfront",
    note: "Parks, beaches, viewpoints, gardens and trails.",
  },
  {
    id: "sights",
    title: "Sights",
    note: "Museums, galleries, landmarks and the like.",
  },
  {
    id: "together",
    title: "Do something together",
    note: "Activities and experiences Atlas holds.",
  },
];

const set = (words: readonly string[]) => new Set(words.map(normaliseSubtype));

const COFFEE = set([
  "cafe",
  "café",
  "coffee shop",
  "coffee roaster",
  "bakery",
  "tea house",
  "juice bar",
]);
const DRINKS = set([
  "bar",
  "pub",
  "brewery",
  "brew pub",
  "wine bar",
  "lounge",
  "distillery",
  "cidery",
  "tasting room",
]);
const EAT = new Set([...intentByKey("eat").subtypes].map(normaliseSubtype));
const OUTSIDE = new Set(
  [...intentByKey("outside").subtypes].map(normaliseSubtype),
);
const CULTURE = new Set(
  [...intentByKey("culture").subtypes].map(normaliseSubtype),
);
/** Outdoors you can walk in the middle of a city. A ski hill is not a stroll. */
const WALKABLE = set([
  "park",
  "regional park",
  "trail",
  "trail network",
  "beach",
  "marina",
  "viewpoint",
  "garden",
  "botanical garden",
  "island",
  "nature reserve",
]);

/**
 * Atlas states parks in many words ("public park", "urban park", "heritage
 * garden"). A place is a walk when Atlas's own subtype carries one of these
 * words (ADR 007: membership by a word Atlas listed) — and not when the word
 * is part of something nobody strolls through.
 */
const WALK_WORD =
  /\b(park|garden|beach|trail|seawall|viewpoint|marina|island|promenade|waterfront)\b/;
const NOT_A_WALK =
  /\b(amusement|theme|water|rv|trailer|car|parking|skate|business|industrial|ball|bike)\b/;

export function shelfOf(c: DiscoveryCandidate): ExploreShelf | null {
  const s = normaliseSubtype(c.subtype);
  if (COFFEE.has(s)) return "coffee";
  if (DRINKS.has(s)) return "drinks";
  if (EAT.has(s)) return "restaurants";
  if (
    (OUTSIDE.has(s) && WALKABLE.has(s)) ||
    (WALK_WORD.test(s) && !NOT_A_WALK.test(s))
  )
    return "waterfront";
  if (CULTURE.has(s)) return "sights";
  if (c.kind === "Activity" || c.kind === "Experience") return "together";
  return null;
}

const CURATED_SHELF: Partial<Record<CuratedKind, ExploreShelf>> = {
  restaurant: "restaurants",
  bar: "drinks",
  activity: "sights",
};

/** [lat, lng] where Atlas observed it; never a derived or town point. */
export function observedAt(
  c: DiscoveryCandidate,
): readonly [number, number] | undefined {
  const geo = c.geography;
  if (!geo?.coordinates || geo.coordinatesBasis !== "observed")
    return undefined;
  const [lng, lat] = geo.coordinates;
  return [lat, lng];
}

const firstSentence = (c: DiscoveryCandidate) =>
  c.knowledge?.descriptionAddsKnowledge === false
    ? undefined
    : c.description?.split(/(?<=\.)\s/)[0]?.slice(0, 160) || undefined;

export function atlasFacts(c: DiscoveryCandidate): PlaceFacts {
  const at = observedAt(c);
  const photo = nearbyImage(c);
  return {
    id: c.id,
    name: c.name,
    ...(at ? { at } : {}),
    ...(photo ? { image: photo.url } : {}),
    ...(firstSentence(c) ? { blurb: firstSentence(c) } : {}),
    from: "atlas",
  };
}

export function curatedFacts(p: CuratedPlace): PlaceFacts {
  return {
    id: p.id,
    name: p.name,
    address: p.address,
    area: p.neighbourhood,
    at: p.at,
    blurb: p.blurb,
    from: "curated",
  };
}

export interface ExploreOptions {
  readonly withinKm?: number;
  readonly perShelf?: number;
}

/**
 * How far each shelf reaches. A coffee is a block away; a walk is somewhere
 * you walk *to*, and Stanley Park is not 2.5 km from the convention centre.
 * Every card still says its own straight-line distance.
 */
const REACH: Partial<Record<ExploreShelf, number>> = { waterfront: 5 };

/**
 * Every shelf near `anchor`, photographed places first and nearest first
 * within that, a handful each. A curated place Atlas already holds (by id or
 * by name) is shown once, as Atlas's.
 */
export function explore(
  candidates: readonly DiscoveryCandidate[],
  curated: readonly CuratedPlace[],
  anchor: readonly [number, number],
  { withinKm = 2.5, perShelf = 6 }: ExploreOptions = {},
): Record<ExploreShelf, ExplorePlace[]> {
  const from = { latitude: anchor[0], longitude: anchor[1] };
  const out = {
    restaurants: [],
    coffee: [],
    drinks: [],
    waterfront: [],
    sights: [],
    together: [],
  } as Record<ExploreShelf, ExplorePlace[]>;
  const seen = new Set<string>();
  for (const c of candidates) {
    const shelf = shelfOf(c);
    const at = observedAt(c);
    if (!shelf || !at || seen.has(c.id)) continue;
    const km = distanceKm(from, { latitude: at[0], longitude: at[1] });
    if (km > (REACH[shelf] ?? withinKm)) continue;
    seen.add(c.id);
    const photo = nearbyImage(c);
    out[shelf].push({
      ...atlasFacts(c),
      shelf,
      subtype: c.subtype,
      kind: c.kind,
      km,
      walkMinutes: walkMinutesFor(km),
      ...(photo ? { photo } : {}),
    });
  }
  for (const { place, km, walkMinutes } of curatedNear(curated, anchor, {
    withinKm: Math.max(withinKm, ...Object.values(REACH)),
  })) {
    const shelf = CURATED_SHELF[place.kind];
    if (!shelf || km > (REACH[shelf] ?? withinKm)) continue;
    const held = out[shelf].some(
      (a) => a.id === place.atlasId || sameName(a.name, place.name),
    );
    if (held) continue;
    out[shelf].push({ ...curatedFacts(place), shelf, km, walkMinutes });
  }
  const tier = (p: ExplorePlace) => (p.photo ? 0 : 1);
  for (const s of Object.keys(out) as ExploreShelf[])
    out[s] = out[s]
      .sort((a, b) => tier(a) - tier(b) || a.km - b.km)
      .slice(0, perShelf);
  return out;
}

/** Where people can choose to explore from: the curated venues and meeting places. */
export function anchorsFrom(
  curated: readonly CuratedPlace[],
): { id: string; name: string; at: readonly [number, number] }[] {
  return curated
    .filter((p) => p.kind === "venue" || p.kind === "meeting")
    .map((p) => ({ id: p.id, name: p.name, at: p.at }));
}
