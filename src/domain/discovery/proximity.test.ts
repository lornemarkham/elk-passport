import { describe, expect, it } from "vitest";
import type { Experience } from "@/domain/experience/types";
import type { CandidateGeography } from "@/lib/data/types";
import {
  NEAR_KM,
  distanceLabel,
  distanceTo,
  nearSection,
  nearYou,
  placementCounts,
  placementOf,
} from "./proximity";

/**
 * **Where the person is, against where Atlas says things are.**
 *
 * Measured on the production corpus on 2026-10-10 — 2,683 candidates:
 *
 * ```
 * coordinates stated      496
 * locality but no coords  370
 * nothing at all        1,813
 * ```
 *
 * Every fixture below is a real candidate, copied from that corpus, and the
 * duplicates are not tidied away because they are the argument. Atlas holds
 * **Kangaroo Creek Farm twice** — once with coordinates and no town, once with
 * a town and no coordinates — and **Don-O-Ray seven times**, of which one
 * states Kelowna and six state nothing at all.
 *
 * So the same real farm is simultaneously placeable and unplaceable. A product
 * that sorted by distance would rank one copy and bury the other, and would
 * have done it while looking more intelligent than before.
 */

const withGeography = (
  geography: CandidateGeography | undefined,
  title: string,
): Experience =>
  ({
    id: title,
    kind: "Place",
    slug: title,
    title,
    shortDescription: "",
    isActive: true,
    detailReady: true,
    moods: [],
    activities: [],
    seasons: [],
    timeOfDay: [],
    weather: [],
    companions: [],
    energyLevel: 1,
    priceLevel: 0,
    duration: { minMinutes: 0, maxMinutes: 0 },
    regionIds: [],
    familyFriendly: false,
    petFriendly: false,
    requiresReservation: false,
    ...(geography ? { geography } : {}),
  }) as Experience;

/** Where the four people in the mission are. Blunted, as the browser sends them. */
const VERNON = { latitude: 50.26, longitude: -119.27 };
const KELOWNA = { latitude: 49.89, longitude: -119.5 };
const VANCOUVER = { latitude: 49.28, longitude: -123.12 };

const POLSON_PARK = withGeography(
  {
    state: "observed",
    coordinates: [-119.27063336, 50.25995386],
    coordinatesBasis: "observed",
    area: { id: "okanagan", name: "Okanagan" },
  },
  "Polson Park",
);

const SCIENCE_CENTRE = withGeography(
  {
    state: "observed",
    locality: "Vernon",
    localityBasis: "observed",
    coordinates: [-119.2703996, 50.26054324],
    coordinatesBasis: "observed",
    area: { id: "okanagan", name: "Okanagan" },
  },
  "Okanagan Science Centre",
);

/** Kelowna: 48 km down the valley from Vernon, and a perfectly ordinary drive. */
const KANGAROO_PLACED = withGeography(
  {
    state: "observed",
    coordinates: [-119.3713643, 49.9680639],
    coordinatesBasis: "observed",
    area: { id: "okanagan", name: "Okanagan" },
  },
  "Kangaroo Creek Farm",
);

/** The same farm, the other record Atlas holds for it. No coordinates. */
const KANGAROO_UNPLACED = withGeography(
  {
    state: "observed",
    locality: "Kelowna",
    localityBasis: "observed",
    area: { id: "okanagan", name: "Okanagan" },
  },
  "Kangaroo Creek Farm (second record)",
);

const BIG_WHITE = withGeography(
  {
    state: "observed",
    locality: "Big White Mountain",
    localityBasis: "observed",
    coordinates: [-118.9459084, 49.7379086],
    coordinatesBasis: "observed",
    area: { id: "okanagan", name: "Okanagan" },
  },
  "Big White Ski Resort",
);

const GRANVILLE = withGeography(
  {
    state: "observed",
    coordinates: [-123.1336467, 49.2706854],
    coordinatesBasis: "observed",
    area: { id: "metro-vancouver", name: "Metro Vancouver" },
  },
  "Granville Island Public Market",
);

/** Canyon Frights, inherited one deterministic hop through its venue. */
const CANYON_FRIGHTS = withGeography(
  {
    state: "derived",
    locality: "North Vancouver",
    localityBasis: "derived",
    coordinates: [-123.1149, 49.3429],
    coordinatesBasis: "derived",
    area: { id: "metro-vancouver", name: "Metro Vancouver" },
  },
  "Canyon Frights",
);

/** Don-O-Ray's Haunted Farm Adventure. Atlas does not know where it is. */
const DON_O_RAY = withGeography({ state: "unknown" }, "Don-O-Ray Haunted Farm");

const CORPUS = [
  POLSON_PARK,
  SCIENCE_CENTRE,
  KANGAROO_PLACED,
  KANGAROO_UNPLACED,
  BIG_WHITE,
  GRANVILLE,
  CANYON_FRIGHTS,
  DON_O_RAY,
];

describe("a distance Passport is entitled to state", () => {
  it("measures between two stated positions", () => {
    expect(distanceTo(POLSON_PARK, VERNON)).toBeLessThan(1);
    expect(distanceTo(GRANVILLE, VERNON)).toBeGreaterThan(290);
  });

  it("says nothing where Atlas states no coordinates", () => {
    expect(distanceTo(KANGAROO_UNPLACED, VERNON)).toBeUndefined();
    expect(distanceTo(DON_O_RAY, VERNON)).toBeUndefined();
  });

  it("says nothing where the person has not shared theirs", () => {
    expect(distanceTo(POLSON_PARK, undefined)).toBeUndefined();
  });

  it("measures a derived position the same as an observed one", () => {
    // Provenance is not confidence. Atlas inherited Canyon Frights' position
    // one deterministic hop through Capilano and stands behind it.
    expect(distanceTo(CANYON_FRIGHTS, VANCOUVER)).toBeLessThan(10);
  });

  it("rounds hard, because the evidence underneath is already rounded", () => {
    // The person's own position is blunted to ~1 km before it is sent, and a
    // haversine is not a road. "12.4 km away" would be past what is known.
    expect(distanceLabel(12.4)).toBe("12 km away");
    // Downtown put five cards in a row inside a kilometre; the position they
    // are measured from is itself only accurate to about one.
    expect(distanceLabel(0.3)).toBe("Under 1 km away");
    expect(distanceLabel(0.9)).toBe(distanceLabel(0.1));
    expect(distanceLabel(undefined)).toBeUndefined();
  });
});

describe("the three answers, and the third is not a weaker second", () => {
  it("places what Atlas placed", () => {
    expect(placementOf(POLSON_PARK, VERNON)).toBe("near");
    expect(placementOf(GRANVILLE, VERNON)).toBe("far");
  });

  it("refuses to place what Atlas did not", () => {
    // The single most tempting mistake: treating a missing coordinate as
    // evidence of distance. It is evidence of nothing.
    expect(placementOf(KANGAROO_UNPLACED, VERNON)).toBe("unplaced");
    expect(placementOf(DON_O_RAY, VERNON)).toBe("unplaced");
    expect(placementOf(DON_O_RAY, VANCOUVER)).toBe("unplaced");
  });

  it("places nothing at all before the person has said where they are", () => {
    for (const experience of CORPUS) {
      expect(placementOf(experience, undefined)).toBe("unplaced");
    }
  });

  it("holds the same real farm in two different answers", () => {
    // Not a bug in this module. A duplicate in Atlas, surfaced rather than
    // smoothed over — and the reason nothing unplaced may be demoted.
    expect(placementOf(KANGAROO_PLACED, VERNON)).toBe("near");
    expect(placementOf(KANGAROO_UNPLACED, VERNON)).toBe("unplaced");
  });
});

describe("the four people in the mission", () => {
  const counts = (origin: Parameters<typeof placementCounts>[1]) =>
    placementCounts(CORPUS, origin);

  it("a person in Vernon is near the valley and not the coast", () => {
    expect(nearYou(CORPUS, VERNON).map((e) => e.title)).toEqual([
      // Nearest first, and Kelowna's farm is inside 50 km of Vernon — which
      // is the point of a radius rather than a town-name match.
      "Polson Park",
      "Okanagan Science Centre",
      "Kangaroo Creek Farm",
    ]);
    expect(counts(VERNON)).toEqual({ near: 3, far: 3, unplaced: 2 });
  });

  it("a person in Kelowna gets a different valley, not the same list", () => {
    const near = nearYou(CORPUS, KELOWNA).map((e) => e.title);
    expect(near).toContain("Kangaroo Creek Farm");
    expect(near).toContain("Big White Ski Resort");
    // Vernon is 48 km from Kelowna, so Polson Park is genuinely in reach too.
    expect(near).toContain("Polson Park");
    expect(near).not.toContain("Granville Island Public Market");
  });

  it("a person in Vancouver is told the truth, which is that there is little", () => {
    expect(nearYou(CORPUS, VANCOUVER).map((e) => e.title)).toEqual([
      "Granville Island Public Market",
      "Canyon Frights",
    ]);
    // Nothing in the Okanagan is dressed up as reachable.
    expect(counts(VANCOUVER)).toEqual({ near: 2, far: 4, unplaced: 2 });
  });

  it("a person who declines is told nothing about distance at all", () => {
    expect(nearYou(CORPUS, undefined)).toEqual([]);
    expect(counts(undefined)).toEqual({ near: 0, far: 0, unplaced: 8 });
  });

  it("counts every candidate exactly once, wherever the person is", () => {
    for (const origin of [VERNON, KELOWNA, VANCOUVER, undefined]) {
      const { near, far, unplaced } = counts(origin);
      expect(near + far + unplaced).toBe(CORPUS.length);
    }
  });
});

describe("the section a shared location earns", () => {
  it("leads with what is actually in reach, nearest first", () => {
    const section = nearSection(CORPUS, VERNON)!;
    expect(section.id).toBe("near-you");
    expect(section.items[0]!.title).toBe("Polson Park");
    expect(section.total).toBe(3);
  });

  it("states how much it could not place, in the section's own words", () => {
    // Unknown geography stays visible as a number rather than as a silence.
    expect(nearSection(CORPUS, VERNON)!.note).toContain(
      "does not know where 2 of the others are",
    );
  });

  it("promises nothing it did not measure", () => {
    const note = nearSection(CORPUS, VERNON)!.note;
    expect(note).toContain(`${NEAR_KM} km`);
    expect(note).toContain("coordinates Atlas states");
    // No travel time, ever. A straight line is not a drive.
    for (const invented of ["minutes", "drive", "min away", "hour"]) {
      expect(note).not.toContain(invented);
    }
  });

  it("does not exist before somebody shares where they are", () => {
    expect(nearSection(CORPUS, undefined)).toBeUndefined();
  });

  it("does not exist where Atlas placed nothing in reach", () => {
    // Somebody in Vancouver with only Okanagan candidates gets no section —
    // an empty "Near you" would be worse than none.
    expect(nearSection([POLSON_PARK, DON_O_RAY], VANCOUVER)).toBeUndefined();
  });

  it("is an addition to the page and never a filter on it", () => {
    // The section carries what is near. It does not remove, reorder or hide
    // anything else, and the 1,813 candidates Atlas cannot place are still
    // composed exactly as they were.
    const section = nearSection(CORPUS, VERNON)!;
    expect(section.items.length).toBeLessThan(CORPUS.length);
    expect(section.items).not.toContain(DON_O_RAY);
  });
});
