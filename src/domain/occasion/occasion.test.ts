import { describe, expect, it } from "vitest";
import type { Experience } from "@/domain/experience/types";
import {
  afterDarkAt,
  eveningOrder,
  fitOccasion,
  readOccasion,
  roleOf,
  shapesThePlan,
  withoutOccasionPhrases,
} from "./occasion";
import { statedCloseOn } from "./hours";
import { savedForAdventure } from "./saved";

const place = (over: Partial<Experience>): Experience =>
  ({
    id: over.title ?? "x",
    kind: "Organization",
    slug: "x",
    title: "Somewhere",
    shortDescription: "",
    detailReady: false,
    moods: [],
    activities: [],
    seasons: [],
    timeOfDay: [],
    weather: [],
    companions: [],
    regionIds: [],
    familyFriendly: false,
    petFriendly: false,
    requiresReservation: false,
    isActive: true,
    ...over,
  }) as Experience;

describe("readOccasion", () => {
  it("hears moods and the things named in passing", () => {
    const o = readOccasion(
      "a romantic Christmas date night with mulled wine, Christmas lights, maybe snow, cozy",
    )!;
    expect(o.moods).toEqual(
      expect.arrayContaining(["romantic", "cozy", "festive", "snowy"]),
    );
    expect(o.wants.map((w) => w.id)).toEqual(
      expect.arrayContaining(["warm-drink", "lights", "snow"]),
    );
  });
  it("hears nothing in a plain day, and party words only lean", () => {
    expect(readOccasion("four hours near Vernon")).toBeUndefined();
    expect(shapesThePlan(readOccasion("with friends"))).toBe(false);
    expect(shapesThePlan(readOccasion("with my wife"))).toBe(false);
    expect(shapesThePlan(readOccasion("a cozy evening"))).toBe(true);
  });
  it("keeps 'mulled wine' from being read as a winery", () => {
    expect(withoutOccasionPhrases("mulled wine and lights")).not.toMatch(
      /wine/,
    );
  });
});

describe("fitOccasion", () => {
  const date = readOccasion("a romantic date night")!;
  it("sinks fast food on a date by Atlas's subtype, not by brand", () => {
    const fit = fitOccasion(place({ subtype: "fast_food_restaurant" }), date);
    expect(fit.score).toBeLessThan(0);
    expect(fit.against).toMatch(/fast food/);
    // The same chain, said by name, is just a place: no brand list.
    expect(
      fitOccasion(place({ title: "McDonald's", subtype: "restaurant" }), date)
        .against,
    ).toBeUndefined();
  });
  it("warns, never claims, about a winery after dark", () => {
    const fit = fitOccasion(place({ subtype: "winery" }), date, {
      afterDark: true,
    });
    expect(fit.closedRisk).toBe(true);
    expect(fit.caution).toMatch(/often close before evening.*no hours/);
  });
  it("believes a place's own hours over its kind", () => {
    const cafe = place({
      subtype: "cafe",
      schedule: {
        stated: "stated",
        statements: [
          {
            text: "Mon: 9:00 AM – 6:00 PM · Sat: 10:00 AM – 5:00 PM · Sun: Closed",
            scope: "subject",
          },
        ],
      },
    });
    expect(statedCloseOn(cafe, "2026-11-07")?.minutes).toBe(17 * 60);
    expect(statedCloseOn(cafe, "2026-11-08")?.closed).toBe(true);
    const fit = fitOccasion(cafe, date, {
      afterDark: true,
      on: "2026-11-07",
      startAt: 18 * 60,
    });
    expect(fit.caution).toMatch(/closes at 5 pm/);
  });
  it("leaves a park in the dark out unless something there is lit", () => {
    expect(
      fitOccasion(place({ subtype: "park" }), date, { afterDark: true })
        .closedRisk,
    ).toBe(true);
  });
  it("treats a building as a venue, not a show", () => {
    expect(fitOccasion(place({ subtype: "theatre" }), date).caution).toMatch(
      /venue, not what's on/,
    );
  });
});

describe("the shape of an evening", () => {
  it("is dinner, then something to do, then something warm", () => {
    const cafe = place({ title: "c", subtype: "cafe" });
    const rink = place({ title: "r", subtype: "arena" });
    const bistro = place({ title: "b", subtype: "bistro" });
    expect(eveningOrder([cafe, rink, bistro]).map((e) => e.title)).toEqual([
      "b",
      "r",
      "c",
    ]);
    expect(roleOf(place({ subtype: "ski resort" }))).toBe("do");
  });
  it("is after dark by the sun, not the clock", () => {
    expect(afterDarkAt({ startAt: 18 * 60, sunsetMinutes: 16 * 60 + 40 })).toBe(
      true,
    );
    expect(afterDarkAt({ startAt: 14 * 60, sunsetMinutes: 16 * 60 + 40 })).toBe(
      false,
    );
  });
});

describe("savedForAdventure", () => {
  it("puts what fits first, sets aside what is over, and keeps it all", () => {
    const beach = place({ title: "Beach", subtype: "beach" });
    const bistro = place({
      title: "Bistro",
      subtype: "bistro",
      geography: { coordinates: [-119.27, 50.27] } as Experience["geography"],
    });
    const gone = place({
      title: "Old market",
      kind: "Event",
      startTime: "2025-12-01T20:00:00Z",
      endTime: "2025-12-02T02:00:00Z",
    });
    const result = savedForAdventure([beach, gone, bistro], {
      said: "a romantic evening",
      origin: { latitude: 50.267, longitude: -119.272 },
      town: "Vernon",
      from: "2026-11-07",
    });
    expect(result.fits[0]!.experience.title).toBe("Bistro");
    expect(result.fits[0]!.why).toMatch(/Close to Vernon/);
    expect(result.elsewhere.map((p) => p.experience.title)).toEqual([
      "Old market",
    ]);
  });
});
