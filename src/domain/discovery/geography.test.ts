import { describe, expect, it } from "vitest";
import type { Experience } from "@/domain/experience/types";
import type { CandidateGeography } from "@/lib/data/types";
import {
  areaLabel,
  dominantArea,
  placeLabel,
  unresolvedPlace,
  whereLine,
} from "./compose";

/**
 * **Atlas owns where things are. Passport owns what it is safe to say.**
 *
 * `candidate-geography/2` arrived with four states, and the difference between
 * them is the whole product: two of them are facts a card may print, and two
 * are silences Passport must not fill.
 *
 * The defect this closes: `Canyon Frights` led *Happening today* with no town
 * at all, beside Okanagan cards that said "· Kelowna" — so the bare card read
 * as local **by omission**, and it is 273 km away at Capilano Suspension
 * Bridge Park in North Vancouver.
 *
 * Every fixture below is the real shape of a real candidate from the live
 * corpus on 2026-10-11.
 */

const withGeography = (
  geography: CandidateGeography | undefined,
  over: Partial<Experience> = {},
): Experience =>
  ({
    id: "e",
    kind: "Event",
    slug: "e",
    title: "A thing",
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
    ...over,
  }) as Experience;

/** Canyon Frights, exactly as Atlas states it. */
const CANYON_FRIGHTS: CandidateGeography = {
  state: "derived",
  locality: "North Vancouver",
  localityBasis: "derived",
  coordinates: [-123.1149, 49.3429],
  coordinatesBasis: "derived",
  area: { id: "metro-vancouver", name: "Metro Vancouver" },
  via: [
    {
      id: "2908d116-212e-45d7-90e0-2804d1f50e7e",
      kind: "Place",
      name: "Capilano Suspension Bridge Park",
      relation: "happens_at",
    },
  ],
};

/** Apple Harvest Fest: its own evidence named the town. */
const APPLE_HARVEST: CandidateGeography = {
  state: "observed",
  locality: "Vernon",
  localityBasis: "observed",
  area: { id: "okanagan", name: "Okanagan" },
};

/** Don-O-Ray's Haunted Farm Adventure. Atlas does not know. */
const UNKNOWN: CandidateGeography = { state: "unknown" };

/** Bean Around the World: the evidence names two towns and Atlas refuses to pick. */
const CONFLICTING_NAMED: CandidateGeography = {
  state: "conflicting",
  localities: ["Vernon", "North Vancouver"],
  conflict: "the evidence places this in Okanagan and Metro Vancouver",
};

/** 28th Annual Spooktacular: Atlas records the disagreement without naming both. */
const CONFLICTING_UNNAMED: CandidateGeography = {
  state: "conflicting",
  conflict: "the evidence places this in Okanagan and salmon arm",
};

describe("the town a card may name", () => {
  it("names an observed locality", () => {
    expect(placeLabel(withGeography(APPLE_HARVEST))).toBe("Vernon");
  });

  it("names a derived one too — provenance is not confidence", () => {
    // Atlas inherited it one deterministic hop through the venue and stands
    // behind it. A card that withheld it would be hiding a fact.
    expect(placeLabel(withGeography(CANYON_FRIGHTS))).toBe("North Vancouver");
  });

  it("names nothing when Atlas does not know", () => {
    expect(placeLabel(withGeography(UNKNOWN))).toBeUndefined();
  });

  it("names nothing when the evidence disagrees", () => {
    // Picking the first of two towns would resolve a disagreement the
    // knowledge engine deliberately refused to resolve.
    expect(placeLabel(withGeography(CONFLICTING_NAMED))).toBeUndefined();
    expect(placeLabel(withGeography(CONFLICTING_UNNAMED))).toBeUndefined();
  });

  it("names nothing at all for an older Atlas with no geography", () => {
    expect(placeLabel(withGeography(undefined))).toBeUndefined();
  });

  it("never prints provenance words at a person", () => {
    const line = whereLine(
      withGeography(CANYON_FRIGHTS, {
        venue: { name: "Capilano Suspension Bridge Park" },
      } as Partial<Experience>),
    )!;
    expect(line).toBe("Capilano Suspension Bridge Park · North Vancouver");
    for (const word of [
      "derived",
      "observed",
      "candidate-geography",
      "happens_at",
    ]) {
      expect(line).not.toContain(word);
    }
  });
});

describe("the area, which is what stops a card looking local", () => {
  it("names the area Atlas states", () => {
    expect(areaLabel(withGeography(CANYON_FRIGHTS))).toBe("Metro Vancouver");
    expect(areaLabel(withGeography(APPLE_HARVEST))).toBe("Okanagan");
  });

  it("says nothing where Atlas states none", () => {
    expect(areaLabel(withGeography(UNKNOWN))).toBeUndefined();
  });
});

describe("what Atlas will not resolve", () => {
  it("offers both towns where the evidence named both", () => {
    expect(unresolvedPlace(withGeography(CONFLICTING_NAMED))).toBe(
      "Vernon or North Vancouver",
    );
  });

  it("still admits the uncertainty where it named neither", () => {
    // Silence on a page of labelled cards reads as "local", which is the
    // deception this whole contract exists to stop.
    expect(unresolvedPlace(withGeography(CONFLICTING_UNNAMED))).toBe(
      "Location not confirmed",
    );
  });

  it("never prints Atlas's own machine-written conflict text", () => {
    const said = unresolvedPlace(withGeography(CONFLICTING_UNNAMED))!;
    expect(said).not.toContain("salmon arm");
    expect(said).not.toContain("evidence");
  });

  it("says nothing about a candidate that is not in conflict", () => {
    expect(unresolvedPlace(withGeography(APPLE_HARVEST))).toBeUndefined();
    expect(unresolvedPlace(withGeography(UNKNOWN))).toBeUndefined();
  });
});

describe("which area this page is mostly about", () => {
  const okanagan = () => withGeography(APPLE_HARVEST);
  const vancouver = () => withGeography(CANYON_FRIGHTS);

  it("is the clear majority, counted from what Atlas states", () => {
    // The live feed is Okanagan 813 against Metro Vancouver 33.
    const pool = [...Array(20)].map(okanagan).concat([vancouver()]);
    expect(dominantArea(pool)).toBe("Okanagan");
  });

  it("refuses to pick when two areas are comparable", () => {
    // A page genuinely spread across two places has no "elsewhere", and
    // inventing one is the heuristic this contract exists to avoid.
    const pool = [okanagan(), okanagan(), vancouver(), vancouver()];
    expect(dominantArea(pool)).toBeUndefined();
  });

  it("says nothing over a pool Atlas has placed nowhere", () => {
    expect(
      dominantArea([withGeography(UNKNOWN), withGeography(UNKNOWN)]),
    ).toBeUndefined();
  });

  it("does not count an unknown as a vote for anywhere", () => {
    const pool = [okanagan(), ...Array(50)].map((e, i) =>
      i === 0 ? okanagan() : withGeography(UNKNOWN),
    );
    expect(dominantArea(pool)).toBe("Okanagan");
  });
});

/**
 * The eight cases the mission named, as fixtures rather than as a live-data
 * assertion — a test that reads production would pass or fail on Atlas's
 * mood.
 */
describe("the named regression cases", () => {
  const home = "Okanagan";
  const elsewhere = (g: CandidateGeography) => {
    const area = areaLabel(withGeography(g));
    return Boolean(area && area !== home);
  };

  it("Canyon Frights cannot pass as local", () => {
    expect(placeLabel(withGeography(CANYON_FRIGHTS))).toBe("North Vancouver");
    expect(elsewhere(CANYON_FRIGHTS)).toBe(true);
  });

  it("54-40, Bruno Mars and the BC Lions all say Vancouver", () => {
    const vancouver: CandidateGeography = {
      state: "derived",
      locality: "Vancouver",
      localityBasis: "derived",
      area: { id: "metro-vancouver", name: "Metro Vancouver" },
    };
    expect(placeLabel(withGeography(vancouver))).toBe("Vancouver");
    expect(elsewhere(vancouver)).toBe(true);
  });

  it("Apple Harvest Fest and the Kelowna Chiefs stay local and useful", () => {
    expect(placeLabel(withGeography(APPLE_HARVEST))).toBe("Vernon");
    expect(elsewhere(APPLE_HARVEST)).toBe(false);

    const chiefs: CandidateGeography = {
      state: "observed",
      locality: "Kelowna",
      localityBasis: "observed",
      area: { id: "okanagan", name: "Okanagan" },
    };
    expect(placeLabel(withGeography(chiefs))).toBe("Kelowna");
    expect(elsewhere(chiefs)).toBe(false);
  });

  it("Don-O-Ray stays unknown rather than being guessed", () => {
    expect(placeLabel(withGeography(UNKNOWN))).toBeUndefined();
    expect(areaLabel(withGeography(UNKNOWN))).toBeUndefined();
    expect(unresolvedPlace(withGeography(UNKNOWN))).toBeUndefined();
  });

  it("Spooktacular is not presented as resolved certainty", () => {
    expect(placeLabel(withGeography(CONFLICTING_UNNAMED))).toBeUndefined();
    expect(unresolvedPlace(withGeography(CONFLICTING_UNNAMED))).toBe(
      "Location not confirmed",
    );
  });
});
