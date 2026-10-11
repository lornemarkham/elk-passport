import { describe, expect, it } from "vitest";
import {
  cautionOf,
  describeJourney,
  isCautioned,
  routedShort,
  straightLineJourney,
  withinMinutes,
  type Journey,
} from "./journey";

const fintryRouted: Journey = {
  kind: "routed",
  mode: "driving",
  minutes: 61,
  roadKm: 50.4,
  straightKm: 22,
  provider: "osrm-demo",
  calculatedAt: "2026-10-11T17:04:12.000Z",
  limitations: [
    "free-flow road speeds from OpenStreetMap: no live or typical traffic",
  ],
};

describe("a straight line is never a travel time", () => {
  it("says 'straight line' and never names a mode or minutes", () => {
    for (const km of [0.4, 2.2, 22, 65.4]) {
      const { headline, caveat } = describeJourney({
        kind: "straight-line",
        km,
        basis: "coordinates",
      });
      expect(headline).toMatch(/in a straight line/);
      expect(`${headline} ${caveat}`).not.toMatch(
        /\bdrive\b|\bdriving\b|\bwalk|\bmin\b|minutes|by road/i,
      );
      expect(caveat).toMatch(/not a travel time/i);
    }
  });

  it("names a town centre as a town centre", () => {
    expect(
      describeJourney({
        kind: "straight-line",
        km: 4,
        basis: "town",
        town: "Lumby",
      }).headline,
    ).toBe("4.0 km in a straight line to Lumby's centre");
  });

  it("answers 'within N minutes' with undefined, however short", () => {
    expect(
      withinMinutes(
        { kind: "straight-line", km: 0.3, basis: "coordinates" },
        60,
      ),
    ).toBeUndefined();
  });

  it("only becomes a journey from a measured Atlas reading", () => {
    expect(
      straightLineJourney({ state: "measured", km: 2.2, basis: "coordinates" }),
    ).toEqual({ kind: "straight-line", km: 2.2, basis: "coordinates" });
    expect(
      straightLineJourney({ state: "bounded", atLeastKm: 40, area: "Shuswap" }),
    ).toBeUndefined();
    expect(straightLineJourney({ state: "unknown" })).toBeUndefined();
    expect(straightLineJourney(undefined)).toBeUndefined();
  });
});

describe("a routed journey", () => {
  it("states minutes, road km and the provider together", () => {
    const { headline, caveat } = describeJourney(fintryRouted);
    expect(headline).toBe("1 h 1 min drive · 50 km by road");
    expect(caveat).toMatch(/^Estimated by osrm-demo; free-flow road speeds/);
  });

  it("carries an access caution into the caveat", () => {
    const { caveat } = describeJourney({
      ...fintryRouted,
      accessCaution: "the point may be inside the site",
    });
    expect(caveat).toMatch(/the point may be inside the site\.$/);
  });

  it("decides 'within' from minutes, not from kilometres", () => {
    // 22 km is close; 61 minutes is not.
    expect(withinMinutes(fintryRouted, 30)).toBe(false);
    expect(withinMinutes(fintryRouted, 61)).toBe(true);
    expect(
      withinMinutes({ ...fintryRouted, minutes: 9, roadKm: 4.5 }, 15),
    ).toBe(true);
  });

  it("does not claim a road for transit", () => {
    expect(
      describeJourney({ ...fintryRouted, mode: "transit", minutes: 42 })
        .headline,
    ).toBe("42 min by transit · 50 km");
  });
});

describe("no answer is said as no answer", () => {
  it("distinguishes no route, unsupported mode and unknown", () => {
    expect(
      describeJourney({
        kind: "no-route",
        mode: "driving",
        provider: "osrm-demo",
        because: "the destination is 3.1 km from the nearest routable road",
      }),
    ).toEqual({
      headline: "No driving route found",
      caveat:
        "The destination is 3.1 km from the nearest routable road (osrm-demo).",
    });
    expect(
      describeJourney({
        kind: "unsupported",
        mode: "transit",
        provider: "osrm-demo",
        because: "osrm-demo is not configured for transit",
      }).headline,
    ).toBe("No transit times available");
    expect(
      withinMinutes({ kind: "unknown", because: "x" }, 60),
    ).toBeUndefined();
  });
});

describe("a route to a point inside an area (travel-legs/1 areaPoint)", () => {
  const area: Journey = { ...fintryRouted, minutes: 82, areaPoint: true };

  it("is cautioned with or without an accessCaution of its own", () => {
    expect(isCautioned(fintryRouted)).toBe(false);
    expect(isCautioned(area)).toBe(true);
    expect(isCautioned({ ...fintryRouted, accessCaution: "slow" })).toBe(true);
    expect(cautionOf(area)).toMatch(/not at the way in/);
    expect(cautionOf({ ...area, accessCaution: "Atlas's own words" })).toBe(
      "Atlas's own words",
    );
  });

  it("never shows its minutes as a time to the way in", () => {
    expect(routedShort(area)).toBeUndefined();
    expect(withinMinutes(area, 120)).toBeUndefined();
    const { headline, caveat } = describeJourney(area);
    expect(headline).toBe(
      "1 h 22 min drive to a point inside it · 50 km by road",
    );
    expect(caveat).toMatch(/not at the way in\.$/);
  });
});
