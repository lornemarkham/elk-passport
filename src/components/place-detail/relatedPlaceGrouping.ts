import type {
  Place,
  PlaceRelatedPlace,
  PlaceRelationship,
} from "@/lib/data/types";
import {
  AMENITY_PLACE_TYPES,
  AMENITY_REACH_KM,
  NEARBY_CARD_LIMIT,
  PLANNING_CATEGORY_BY_PLACE_TYPE,
  WHILE_HERE_REACH_KM,
  type PlanningCategory,
} from "./content";

/**
 * Extracted from `PlaceKeepExploring` (Phase 8.1's original home for this
 * logic) so a second consumer — `PlaceFirstThing` / `PlaceAfterwards`
 * (Phase 7.5) — doesn't need its own copy. One real computation, two
 * different places on the page choose to render different slices of its
 * result: `PlaceKeepExploring` still shows all of it (the full exploration
 * list, repositioned lower); the new decision-first sections each show
 * exactly one category, elevated and framed as a direct answer to one
 * traveler question. Nothing about how `near`/`contains` edges are
 * computed or stored changed — this is presentation-layer grouping only.
 *
 * ## QC #4 (2026-09-17): a small number of genuinely nearby things, truthfully
 *
 * Atlas asserts `near` out to 15 km, and Kal Beach's page rendered all 26 of
 * its neighbours in database order, every one captioned "Only a few minutes
 * away." — a parking lot 10 km off, "Viewpoint" and "Public Washroom" twice
 * each, the District of Coldstream, and the Okanagan region itself as
 * "Part of the same area." Nothing there was false about the graph; all of
 * it was untrue as a sentence to a visitor.
 *
 * Atlas's detail route now carries, per related Place, what it holds
 * independently of the edge (`PlaceRelatedPlace`): the straight-line
 * distance between held points, whether the other end is a Region, and
 * whether its name is only its type. Selection and order are deterministic
 * and use nothing else:
 *
 * 1. **Excluded**: the Place itself; a Region (what this Place is *in*, not
 *    somewhere to go from it); a Place named only by its type (a card that
 *    says "Parking" is a category, not a destination); and an amenity
 *    (`AMENITY_PLACE_TYPES`) further than `AMENITY_REACH_KM` — a toilet is
 *    useful relative to where you are, not as a place to drive to.
 * 2. **Ordered** by distance ascending, unknown distance last, then by name —
 *    never by arrival order, never by a score.
 * 3. **Capped** at `NEARBY_CARD_LIMIT` after ordering, so the nearest survive.
 *    A `during` type is grouped under "While You're Here" only within
 *    `WHILE_HERE_REACH_KM`; further away it is listed with its distance.
 * 4. **Captioned** with the distance Atlas computed (`distanceCaption`), or
 *    "Nearby." when Atlas asserts `near` without two held points. Never a
 *    travel time: Atlas holds no route, so the page states no minutes.
 * 5. **Illustrated** only by the destination's representative image as
 *    Atlas's read carries it (ADR 069) — a card with no evidenced image
 *    shows none, rather than a photograph of something else.
 *
 * ## One card per destination, not one card per edge
 *
 * A card is somewhere a traveller can go, so the same place must not appear
 * twice however many edges lead to it. Two things in the live graph made it:
 *
 * **Reciprocal edges.** `near` is symmetric and Atlas stores 29 pairs in both
 * directions — `Kalamalka Lake Park → Trail Parking` *and* `Trail Parking →
 * Kalamalka Lake Park`. Walking edges produced two identical cards, and React
 * reported two children with the key `aeaaebd3-…`. Kalamalka Lake Park alone
 * rendered 34 cards for 28 destinations.
 *
 * **Self-edges.** Five relationships in the corpus point an entity at itself
 * (four `near`, one `possible-duplicate-of`), so a place appeared in its own
 * "Keep Exploring" as somewhere else to go. Those are an Atlas data defect and
 * are reported as one; skipping them here is not a workaround for that, it is
 * this function refusing to call a place its own destination — which it would
 * have to refuse even if the graph were clean.
 *
 * The first edge to a destination decides its relationship type for the
 * caption. Deduplication is by destination, not by (destination, type),
 * because a second card that says something slightly different about the
 * same place is still a second card.
 */

export interface DestinationCardData {
  readonly place: Place;
  readonly caption: string;
  /** Atlas's straight-line distance, when both ends hold a point. */
  readonly distanceKm?: number;
  /**
   * The image the card may show as the destination: Atlas's representative
   * image for it (ADR 069), or none. With an Atlas that predates the field,
   * the destination's own lead-image scalar. Never chosen here.
   */
  readonly imageUrl?: string;
}

/**
 * The one sentence a card may say about how far away it is: what Atlas
 * computed from two held points, formatted so the precision matches the
 * number. Under a kilometre in metres to the nearest ten, under ten
 * kilometres to one decimal, beyond that whole kilometres. No minutes, no
 * "short walk", no "drive" — Atlas holds no route or travel time, and the
 * page must not imply one.
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) return `${Math.round((distanceKm * 1000) / 10) * 10} m`;
  if (distanceKm < 10) return `${distanceKm.toFixed(1)} km`;
  return `${Math.round(distanceKm)} km`;
}

/** A one-line reason a card is here — never the raw relationship type, and
 * never a travel time. `near` reads as the distance Atlas computed, or
 * "Nearby." when it computed none; `contains` has a direction that matters,
 * so it reads differently depending on which end of the edge the *current*
 * place is on. A future relationship type still gets a real sentence, never a
 * raw graph term, even before anyone writes a specific line for it. */
export function distanceCaption(
  type: string,
  currentIsSource: boolean,
  distanceKm: number | undefined,
): string {
  if (type === "near")
    return distanceKm === undefined
      ? "Nearby."
      : `${formatDistance(distanceKm)} away.`;
  if (type === "contains")
    return currentIsSource
      ? "Right here, worth a look."
      : "Part of the same area.";
  return distanceKm === undefined
    ? "Worth exploring nearby."
    : `${formatDistance(distanceKm)} away.`;
}

export function excerpt(text: string, max = 90): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max).trimEnd()}…`;
}

export interface GroupedRelatedPlaces {
  readonly grouped: Record<PlanningCategory, DestinationCardData[]>;
  readonly general: DestinationCardData[];
}

/**
 * The one real computation: walk every relationship touching `currentPlace`,
 * resolve each to its full related `Place` record (skipping a stale
 * reference or a related fetch that failed — never breaks the page), select
 * and order as documented above, and sort each survivor into
 * Before/During/After when it's a `near` edge whose related place's
 * `placeType` is in `PLANNING_CATEGORY_BY_PLACE_TYPE` — everything else (a
 * `contains` edge, or a `near` edge to an unmapped place type) lands in
 * `general`, the same "never force a category it wasn't confidently mapped
 * to" rule this has always followed.
 *
 * `relatedPlaces` is what Atlas's detail route says about each related
 * Place (distance, region, generic name). Optional so an Atlas predating
 * those fields still renders: without them nothing is excluded for distance
 * or type, order falls back to name, and every `near` card reads "Nearby."
 */
export function groupRelatedPlaces(
  currentPlace: Place,
  relationships: readonly PlaceRelationship[],
  relatedPlaceDetails: readonly Place[],
  relatedPlaces: readonly PlaceRelatedPlace[] = [],
): GroupedRelatedPlaces {
  const detailsById = new Map(
    relatedPlaceDetails.map((p) => [p.id, p] as const),
  );
  const viewById = new Map(relatedPlaces.map((p) => [p.id, p] as const));

  const candidates: {
    readonly card: DestinationCardData;
    readonly type: string;
  }[] = [];
  const placed = new Set<string>();

  for (const r of relationships) {
    const currentIsSource = r.sourceEntityId === currentPlace.id;
    const otherId = currentIsSource ? r.targetEntityId : r.sourceEntityId;
    if (otherId === currentPlace.id) continue; // a place is not its own destination
    if (placed.has(otherId)) continue; // already has a card, from an earlier edge
    const other = detailsById.get(otherId);
    if (!other) continue; // stale reference, or the related fetch failed — skip, don't break the section
    const view = viewById.get(otherId);
    if (view?.region) continue; // what this place is in, not somewhere to go
    if (view?.nameIsOnlyItsType) continue; // "Parking" is a category, not a destination
    const distanceKm = view?.distanceKm;
    if (
      AMENITY_PLACE_TYPES.has(other.placeType) &&
      (distanceKm === undefined || distanceKm > AMENITY_REACH_KM)
    )
      continue; // an amenity is useful where you are, not a place to drive to
    placed.add(otherId);

    // A card image is the claim "this is what the destination looks like".
    // Only Atlas's representative image makes it; a related-place view with
    // none means Atlas has none it can vouch for, and the card shows none.
    const imageUrl = view ? view.imageUrl : other.imageUrl;
    candidates.push({
      type: r.type,
      card: {
        place: other,
        caption: distanceCaption(r.type, currentIsSource, distanceKm),
        ...(distanceKm !== undefined ? { distanceKm } : {}),
        ...(imageUrl ? { imageUrl } : {}),
      },
    });
  }

  candidates.sort((a, b) => {
    const da = a.card.distanceKm,
      db = b.card.distanceKm;
    if (da !== undefined && db !== undefined && da !== db) return da - db;
    if (da === undefined && db !== undefined) return 1;
    if (da !== undefined && db === undefined) return -1;
    return (
      a.card.place.name.localeCompare(b.card.place.name) ||
      a.card.place.id.localeCompare(b.card.place.id)
    );
  });

  const grouped: Record<PlanningCategory, DestinationCardData[]> = {
    before: [],
    during: [],
    after: [],
  };
  const general: DestinationCardData[] = [];

  for (const { card, type } of candidates.slice(0, NEARBY_CARD_LIMIT)) {
    const mapped =
      type === "near"
        ? PLANNING_CATEGORY_BY_PLACE_TYPE[card.place.placeType]
        : undefined;
    // "While You're Here" claims co-location; a viewpoint 11 km away is not
    // here. Only a `during` type within reach is grouped there.
    const category =
      mapped === "during" &&
      (card.distanceKm === undefined || card.distanceKm > WHILE_HERE_REACH_KM)
        ? undefined
        : mapped;
    if (category) {
      grouped[category].push(card);
    } else {
      general.push(card);
    }
  }

  return { grouped, general };
}
