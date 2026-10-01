import { describe, expect, it } from "vitest";
import { OCTOBER_PLACES } from "@/domain/environment/places";
import type { Experience } from "@/domain/experience/types";
import { byNearest, localnessOf, type PlacePoints } from "./localness";

/**
 * **Changing Vernon to Kelowna has to change October, or the area is a
 * weather setting pretending to be a product.**
 *
 * The rule that matters most here is the one about not knowing: two thirds of
 * dated things have no location Atlas will vouch for, and they must not be
 * treated as distant. Undecidable is its own answer.
 */
const vernon = OCTOBER_PLACES.find((p) => p.id === "vernon")!;
const kelowna = OCTOBER_PLACES.find((p) => p.id === "kelowna")!;

/** O'Keefe Ranch and a Kelowna lounge — both real, both from the live feed. */
const points: PlacePoints = new Map([
  ["okeefe", { latitude: 50.40611111, longitude: -119.32083333 }],
  ["dakodas", { latitude: 49.8824739, longitude: -119.4637975 }],
]);

const at = (placeId?: string, locality?: string): Experience =>
  ({
    id: "e1",
    kind: "Event",
    title: "A thing",
    shortDescription: "",
    slug: "a-thing",
    detailReady: true,
    energyLevel: 2,
    priceLevel: 1,
    duration: { minMinutes: 60, maxMinutes: 120 },
    moods: [],
    activities: [],
    seasons: [],
    timeOfDay: [],
    weather: [],
    companions: [],
    regionIds: [],
    familyFriendly: true,
    petFriendly: false,
    requiresReservation: false,
    isActive: true,
    ...(placeId || locality
      ? { venue: { placeId, locality, basis: "happens-at" as const } }
      : {}),
  }) as Experience;

describe("how near a thing is", () => {
  it("calls the next valley over a drive", () => {
    const from = localnessOf(at("dakodas", "Kelowna"), vernon, points);
    expect(from.nearness).toBe("a-drive");
    expect(from.km).toBeGreaterThan(40);
  });

  it("calls a ranch up the road nearby", () => {
    const from = localnessOf(at("okeefe", "Vernon"), vernon, points);
    expect(["here", "nearby"]).toContain(from.nearness);
  });

  it("flips when the person moves", () => {
    // The same two subjects, judged from Kelowna instead.
    expect(localnessOf(at("dakodas"), kelowna, points).nearness).toBe("here");
    expect(localnessOf(at("okeefe"), kelowna, points).nearness).toBe("a-drive");
  });

  it("keeps the town Atlas asserted", () => {
    expect(localnessOf(at("okeefe", "Vernon"), vernon, points).locality).toBe(
      "Vernon",
    );
  });
});

describe("what it refuses to do", () => {
  it("never guesses a location for a subject that has none", () => {
    const unplaced = localnessOf(at(), vernon, points);
    expect(unplaced.nearness).toBe("unknown");
    expect(unplaced.km).toBeUndefined();
  });

  it("does not infer coordinates from a locality name", () => {
    // Atlas said "Vernon" but gave no place we can resolve. That is a label,
    // not a position, and it must not become one.
    const named = localnessOf(at(undefined, "Vernon"), vernon, points);
    expect(named.nearness).toBe("unknown");
    expect(named.km).toBeUndefined();
    expect(named.locality).toBe("Vernon");
  });

  it("knows nothing when the person has set no area", () => {
    expect(
      localnessOf(at("okeefe", "Vernon"), undefined, points).nearness,
    ).toBe("unknown");
  });
});

describe("ordering", () => {
  const here = at("okeefe", "Vernon");
  const far = at("dakodas", "Kelowna");
  const unplaced = at();

  it("puts what is near first and what is far last", () => {
    const sorted = [far, unplaced, here].sort(
      byNearest((e) => localnessOf(e, vernon, points)),
    );
    expect(sorted[0]).toBe(here);
    expect(sorted[2]).toBe(far);
  });

  it("keeps the unplaced in the middle, never demoted below the distant", () => {
    const sorted = [far, unplaced].sort(
      byNearest((e) => localnessOf(e, vernon, points)),
    );
    // An unplaced thing is one Atlas has not told us about, not a far one.
    expect(sorted[0]).toBe(unplaced);
  });

  it("hides nothing — a reorder, not a filter", () => {
    const all = [far, unplaced, here];
    const sorted = [...all].sort(
      byNearest((e) => localnessOf(e, vernon, points)),
    );
    expect(sorted).toHaveLength(all.length);
    expect(new Set(sorted)).toEqual(new Set(all));
  });

  it("does not reshuffle when nobody has set an area", () => {
    const all = [far, unplaced, here];
    const sorted = [...all].sort(
      byNearest((e) => localnessOf(e, undefined, points)),
    );
    expect(sorted).toEqual(all);
  });
});
