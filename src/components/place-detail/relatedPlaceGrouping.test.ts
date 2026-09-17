import { describe, expect, it } from "vitest";
import type {
  Place,
  PlaceRelatedPlace,
  PlaceRelationship,
} from "@/lib/data/types";
import {
  distanceCaption,
  formatDistance,
  groupRelatedPlaces,
} from "./relatedPlaceGrouping";
import { NEARBY_CARD_LIMIT } from "./content";

/**
 * Every case here is taken from the live Okanagan corpus rather than invented.
 * `Kalamalka Lake Park` really does hold reciprocal `near` edges to six
 * neighbours and two edges pointing at itself, and it is the page that made
 * React report two children with the key `aeaaebd3-…`. Kal Beach really does
 * hold `near` to a parking lot 10.3 km away, to "Viewpoint" twice, and
 * `contains` from the Okanagan region 50 km off — and rendered them all as
 * "Only a few minutes away." before QC #4.
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

const view = (
  p: Place,
  over: Partial<PlaceRelatedPlace> = {},
): PlaceRelatedPlace => ({
  id: p.id,
  name: p.name,
  placeType: p.placeType,
  ...over,
});

const KAL_PARK = place("kal-park", "Kalamalka Lake Park", "park");
const TRAIL_PARKING = place("trail-parking", "Trail Parking", "parking");
const VERNON = place("vernon", "Vernon", "city");
const KAL_BEACH = place("kal-beach", "Kal Beach", "beach");
const LAUNCH = place("launch", "Kalavista Boat Launch", "boat launch");
const KINLOCH = place("kinloch", "Kinloch Boat Launch", "boat launch");
const KEKULI = place("kekuli", "Kekuli Bay Provincial Park", "provincial park");
const VIEWPOINT = place("viewpoint", "Viewpoint", "viewpoint");
const OKANAGAN = place("okanagan", "Okanagan", "region");

const allCards = (result: ReturnType<typeof groupRelatedPlaces>) => [
  ...result.grouped.before,
  ...result.grouped.during,
  ...result.grouped.after,
  ...result.general,
];

describe("groupRelatedPlaces — one card per destination (unchanged)", () => {
  it("renders one card per destination when `near` is stored in both directions", () => {
    const result = groupRelatedPlaces(
      KAL_PARK,
      [
        edge("near", KAL_PARK.id, TRAIL_PARKING.id),
        edge("near", TRAIL_PARKING.id, KAL_PARK.id),
      ],
      [TRAIL_PARKING],
      [view(TRAIL_PARKING, { distanceKm: 0.2 })],
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
      [view(TRAIL_PARKING, { distanceKm: 0.2 })],
    );

    expect(allCards(result)).toEqual([
      {
        place: TRAIL_PARKING,
        caption: "Right here, worth a look.",
        distanceKm: 0.2,
      },
    ]);
  });

  it("still sorts a `near` edge into its planning category", () => {
    const result = groupRelatedPlaces(
      KAL_PARK,
      [edge("near", KAL_PARK.id, TRAIL_PARKING.id)],
      [TRAIL_PARKING],
      [view(TRAIL_PARKING, { distanceKm: 0.3 })],
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

describe("groupRelatedPlaces — QC #4 selection, order and captions", () => {
  it("orders by Atlas's distance ascending, unknown distance last, then by name — never by arrival order", () => {
    const result = groupRelatedPlaces(
      KAL_BEACH,
      [
        edge("near", KAL_BEACH.id, KEKULI.id),
        edge("near", KINLOCH.id, KAL_BEACH.id),
        edge("near", KAL_BEACH.id, VERNON.id),
        edge("near", KAL_BEACH.id, LAUNCH.id),
      ],
      [KEKULI, KINLOCH, VERNON, LAUNCH],
      [
        view(KEKULI, { distanceKm: 7.502 }),
        view(KINLOCH, { distanceKm: 1.384 }),
        view(VERNON),
        view(LAUNCH, { distanceKm: 0.266 }),
      ],
    );

    expect(allCards(result).map((c) => c.place.name)).toEqual([
      "Kalavista Boat Launch",
      "Kinloch Boat Launch",
      "Kekuli Bay Provincial Park",
      "Vernon",
    ]);
  });

  it("is deterministic: the same input yields the same order twice, and a reversed input yields the same order", () => {
    const rels = [
      edge("near", KAL_BEACH.id, KEKULI.id),
      edge("near", KAL_BEACH.id, LAUNCH.id),
      edge("near", KAL_BEACH.id, KINLOCH.id),
    ];
    const views = [
      view(KEKULI, { distanceKm: 7.5 }),
      view(LAUNCH, { distanceKm: 0.3 }),
      view(KINLOCH, { distanceKm: 1.4 }),
    ];
    const a = allCards(
      groupRelatedPlaces(KAL_BEACH, rels, [KEKULI, LAUNCH, KINLOCH], views),
    );
    const b = allCards(
      groupRelatedPlaces(
        KAL_BEACH,
        [...rels].reverse(),
        [KINLOCH, LAUNCH, KEKULI],
        [...views].reverse(),
      ),
    );
    expect(a).toEqual(b);
    expect(a.map((c) => c.place.id)).toEqual([
      LAUNCH.id,
      KINLOCH.id,
      KEKULI.id,
    ]);
  });

  it("does not let a parent Region become a destination card", () => {
    const result = groupRelatedPlaces(
      KAL_BEACH,
      [
        edge("contains", OKANAGAN.id, KAL_BEACH.id),
        edge("near", KAL_BEACH.id, LAUNCH.id),
      ],
      [OKANAGAN, LAUNCH],
      [
        view(OKANAGAN, { distanceKm: 50.754, region: true }),
        view(LAUNCH, { distanceKm: 0.266 }),
      ],
    );
    expect(allCards(result).map((c) => c.place.id)).toEqual([LAUNCH.id]);
  });

  it("does not render a Place named only by its type", () => {
    const result = groupRelatedPlaces(
      KAL_BEACH,
      [
        edge("near", KAL_BEACH.id, VIEWPOINT.id),
        edge("near", KAL_BEACH.id, LAUNCH.id),
      ],
      [VIEWPOINT, LAUNCH],
      [
        view(VIEWPOINT, { distanceKm: 0.1, nameIsOnlyItsType: true }),
        view(LAUNCH, { distanceKm: 0.266 }),
      ],
    );
    expect(allCards(result).map((c) => c.place.id)).toEqual([LAUNCH.id]);
  });

  it("shows an amenity only within reach: a parking lot 10 km away is not a destination, one 200 m away is", () => {
    const farParking = place("far", "Trail Parking", "parking");
    const nearParking = place("close", "Beach Parking", "parking");
    const result = groupRelatedPlaces(
      KAL_BEACH,
      [
        edge("near", KAL_BEACH.id, farParking.id),
        edge("near", KAL_BEACH.id, nearParking.id),
      ],
      [farParking, nearParking],
      [
        view(farParking, { distanceKm: 10.301 }),
        view(nearParking, { distanceKm: 0.2 }),
      ],
    );
    expect(allCards(result).map((c) => c.place.id)).toEqual([nearParking.id]);
  });

  it("does not show an amenity whose distance Atlas does not hold", () => {
    const result = groupRelatedPlaces(
      KAL_BEACH,
      [edge("near", KAL_BEACH.id, TRAIL_PARKING.id)],
      [TRAIL_PARKING],
      [view(TRAIL_PARKING)],
    );
    expect(allCards(result)).toEqual([]);
  });

  it("groups a `during` type under While You're Here only within reach; further away it is listed with its distance", () => {
    const farViewpoint = place(
      "far-vp",
      "Okanagan Lake Viewpoint",
      "viewpoint",
    );
    const nearBeach = place("cosens", "Cosens Bay Beach", "beach");
    const result = groupRelatedPlaces(
      KAL_BEACH,
      [
        edge("near", KAL_BEACH.id, nearBeach.id),
        edge("near", KAL_BEACH.id, farViewpoint.id),
      ],
      [nearBeach, farViewpoint],
      [
        view(nearBeach, { distanceKm: 0.9 }),
        view(farViewpoint, { distanceKm: 10.788 }),
      ],
    );
    expect(result.grouped.during.map((c) => c.place.id)).toEqual([
      nearBeach.id,
    ]);
    expect(result.general.map((c) => [c.place.id, c.caption])).toEqual([
      [farViewpoint.id, "11 km away."],
    ]);
  });

  it("caps the cards at the nearest NEARBY_CARD_LIMIT", () => {
    const many = Array.from({ length: NEARBY_CARD_LIMIT + 5 }, (_, i) =>
      place(`p${i}`, `Place ${String(i).padStart(2, "0")}`, "park"),
    );
    const result = groupRelatedPlaces(
      KAL_BEACH,
      many.map((p) => edge("near", KAL_BEACH.id, p.id)),
      many,
      many.map((p, i) => view(p, { distanceKm: 15 - i * 0.5 })),
    );
    const cards = allCards(result);
    expect(cards).toHaveLength(NEARBY_CARD_LIMIT);
    // The nearest survive: the last-defined places had the smallest distances.
    expect(cards[0]!.place.id).toBe(`p${many.length - 1}`);
    expect(cards.map((c) => c.distanceKm)).toEqual(
      [...cards.map((c) => c.distanceKm!)].sort((a, b) => a - b),
    );
  });

  it("captions a `near` card with Atlas's distance, and 'Nearby.' when Atlas holds none — never minutes", () => {
    const result = groupRelatedPlaces(
      KAL_BEACH,
      [
        edge("near", KAL_BEACH.id, LAUNCH.id),
        edge("near", KAL_BEACH.id, KEKULI.id),
        edge("near", KAL_BEACH.id, VERNON.id),
      ],
      [LAUNCH, KEKULI, VERNON],
      [
        view(LAUNCH, { distanceKm: 0.266 }),
        view(KEKULI, { distanceKm: 7.502 }),
        view(VERNON),
      ],
    );
    const captions = Object.fromEntries(
      allCards(result).map((c) => [c.place.id, c.caption]),
    );
    expect(captions).toEqual({
      [LAUNCH.id]: "270 m away.",
      [KEKULI.id]: "7.5 km away.",
      [VERNON.id]: "Nearby.",
    });
    for (const caption of Object.values(captions)) {
      expect(caption).not.toMatch(/minute|walk|drive/i);
    }
  });

  it("without Atlas's related-place view (an older Atlas) nothing is excluded for distance, and every `near` reads 'Nearby.'", () => {
    const result = groupRelatedPlaces(
      KAL_BEACH,
      [
        edge("near", KAL_BEACH.id, TRAIL_PARKING.id),
        edge("near", KAL_BEACH.id, VERNON.id),
      ],
      [TRAIL_PARKING, VERNON],
    );
    // An amenity with no held distance is still not a destination.
    expect(allCards(result).map((c) => [c.place.id, c.caption])).toEqual([
      [VERNON.id, "Nearby."],
    ]);
  });
});

describe("groupRelatedPlaces — card imagery (ADR 069)", () => {
  it("shows only the destination's representative image from Atlas's view; a view without one shows none even when the Place carries a stale scalar", () => {
    const stale: Place = { ...KEKULI, imageUrl: "https://cdn/listicle-og.jpg" };
    const evidenced: Place = { ...LAUNCH, imageUrl: "https://cdn/launch.jpg" };
    const result = groupRelatedPlaces(
      KAL_BEACH,
      [
        edge("near", KAL_BEACH.id, stale.id),
        edge("near", KAL_BEACH.id, evidenced.id),
      ],
      [stale, evidenced],
      [
        view(stale, { distanceKm: 7.5 }),
        view(evidenced, {
          distanceKm: 0.3,
          imageUrl: "https://cdn/launch.jpg",
        }),
      ],
    );
    expect(
      Object.fromEntries(allCards(result).map((c) => [c.place.id, c.imageUrl])),
    ).toEqual({
      [LAUNCH.id]: "https://cdn/launch.jpg",
      [KEKULI.id]: undefined,
    });
  });

  it("uses the destination's own scalar only when Atlas sends no related-place view (an older Atlas)", () => {
    const old: Place = { ...VERNON, imageUrl: "https://cdn/vernon.jpg" };
    const result = groupRelatedPlaces(
      KAL_BEACH,
      [edge("near", KAL_BEACH.id, old.id)],
      [old],
    );
    expect(allCards(result)[0]!.imageUrl).toBe("https://cdn/vernon.jpg");
  });
});

describe("formatDistance / distanceCaption", () => {
  it("formats to the precision the number supports and states no travel time", () => {
    expect(formatDistance(0.266)).toBe("270 m");
    expect(formatDistance(0.004)).toBe("0 m");
    expect(formatDistance(0.999)).toBe("1000 m");
    expect(formatDistance(1.384)).toBe("1.4 km");
    expect(formatDistance(9.96)).toBe("10.0 km");
    expect(formatDistance(10.301)).toBe("10 km");
    expect(formatDistance(14.832)).toBe("15 km");
  });

  it("gives `contains` its direction and every other type a sentence, never a raw graph term", () => {
    expect(distanceCaption("contains", true, undefined)).toBe(
      "Right here, worth a look.",
    );
    expect(distanceCaption("contains", false, 3)).toBe(
      "Part of the same area.",
    );
    expect(distanceCaption("includes", false, undefined)).toBe(
      "Worth exploring nearby.",
    );
    expect(distanceCaption("includes", false, 2.25)).toBe("2.3 km away.");
    expect(distanceCaption("near", true, undefined)).toBe("Nearby.");
  });
});
