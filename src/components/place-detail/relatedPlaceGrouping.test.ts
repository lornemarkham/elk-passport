import { describe, expect, it } from "vitest";
import type { Place, PlaceRelationship } from "@/lib/data/types";
import { groupRelatedPlaces } from "./relatedPlaceGrouping";

/**
 * Every case here is taken from the live Okanagan corpus rather than invented.
 * `Kalamalka Lake Park` really does hold reciprocal `near` edges to six
 * neighbours and two edges pointing at itself, and it is the page that made
 * React report two children with the key `aeaaebd3-…`.
 */

const place = (id: string, name: string, placeType: string): Place => ({
  kind: "Place",
  id,
  name,
  aliases: [],
  placeType,
  description: `${name} description`,
});

const edge = (
  type: string,
  sourceEntityId: string,
  targetEntityId: string,
): PlaceRelationship => ({
  id: `${type}-${sourceEntityId}-${targetEntityId}`,
  type,
  sourceEntityId,
  targetEntityId,
});

const KAL_PARK = place("kal-park", "Kalamalka Lake Park", "park");
const TRAIL_PARKING = place("trail-parking", "Trail Parking", "parking");
const VERNON = place("vernon", "Vernon", "city");

const allCards = (result: ReturnType<typeof groupRelatedPlaces>) => [
  ...result.grouped.before,
  ...result.grouped.during,
  ...result.grouped.after,
  ...result.general,
];

describe("groupRelatedPlaces", () => {
  it("renders one card per destination when `near` is stored in both directions", () => {
    const result = groupRelatedPlaces(
      KAL_PARK,
      [
        edge("near", KAL_PARK.id, TRAIL_PARKING.id),
        edge("near", TRAIL_PARKING.id, KAL_PARK.id),
      ],
      [TRAIL_PARKING],
    );

    expect(allCards(result).map((c) => c.place.id)).toEqual([TRAIL_PARKING.id]);
  });

  it("never renders the current place as its own destination", () => {
    const result = groupRelatedPlaces(
      KAL_PARK,
      [
        edge("near", KAL_PARK.id, KAL_PARK.id),
        edge("possible-duplicate-of", KAL_PARK.id, KAL_PARK.id),
        edge("near", KAL_PARK.id, VERNON.id),
      ],
      [KAL_PARK, VERNON],
    );

    expect(allCards(result).map((c) => c.place.id)).toEqual([VERNON.id]);
  });

  it("produces unique React keys for a place with many reciprocal neighbours", () => {
    const neighbours = ["a", "b", "c", "d"].map((n) =>
      place(n, `Neighbour ${n}`, "park"),
    );
    const relationships = neighbours.flatMap((n) => [
      edge("near", KAL_PARK.id, n.id),
      edge("near", n.id, KAL_PARK.id),
    ]);

    const ids = allCards(
      groupRelatedPlaces(KAL_PARK, relationships, neighbours),
    ).map((c) => c.place.id);

    expect(ids).toHaveLength(new Set(ids).size);
    expect(ids).toHaveLength(neighbours.length);
  });

  it("keeps the caption from the first edge that reached the destination", () => {
    const result = groupRelatedPlaces(
      KAL_PARK,
      [
        edge("contains", KAL_PARK.id, TRAIL_PARKING.id),
        edge("near", TRAIL_PARKING.id, KAL_PARK.id),
      ],
      [TRAIL_PARKING],
    );

    expect(allCards(result)).toEqual([
      { place: TRAIL_PARKING, caption: "Right here, worth a look." },
    ]);
  });

  it("still sorts a `near` edge into its planning category", () => {
    const result = groupRelatedPlaces(
      KAL_PARK,
      [edge("near", KAL_PARK.id, TRAIL_PARKING.id)],
      [TRAIL_PARKING],
    );

    expect(result.grouped.during.map((c) => c.place.id)).toEqual([
      TRAIL_PARKING.id,
    ]);
    expect(result.general).toEqual([]);
  });

  it("still leaves an unresolvable related place out rather than breaking", () => {
    const result = groupRelatedPlaces(
      KAL_PARK,
      [
        edge("near", KAL_PARK.id, "never-loaded"),
        edge("near", KAL_PARK.id, VERNON.id),
      ],
      [VERNON],
    );

    expect(allCards(result).map((c) => c.place.id)).toEqual([VERNON.id]);
  });
});
