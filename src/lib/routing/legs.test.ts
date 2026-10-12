import { describe, expect, it } from "vitest";
import type { Journey } from "./journey";
import {
  chainLegs,
  describeTravelTotal,
  shownLeg,
  straightLeg,
  travelTotal,
} from "./legs";
import { DAVISON, OKEEFE, VERNON_START } from "./fixtures";

const routed = (minutes: number, roadKm: number, mode = "driving"): Journey =>
  ({
    kind: "routed",
    mode,
    minutes,
    roadKm,
    straightKm: 1,
    provider: "osrm",
    calculatedAt: "2026-10-11T17:04:12.000Z",
    limitations: [],
  }) as Journey;
const noRoute: Journey = {
  kind: "no-route",
  mode: "driving",
  provider: "osrm",
  because: "no route between them",
};

const day = chainLegs(VERNON_START, [DAVISON, OKEEFE], { returnHome: true });

describe("chainLegs", () => {
  it("starts at the start, visits each stop, and comes home", () => {
    expect(day.map((l) => `${l.from.name}→${l.to.name}`)).toEqual([
      "Vernon→Davison Orchards",
      "Davison Orchards→O'Keefe Ranch",
      "O'Keefe Ranch→Vernon",
    ]);
    expect(day.map((l) => Boolean(l.home))).toEqual([false, false, true]);
  });

  it("has only place-to-place legs, and no way home, without a start", () => {
    const legs = chainLegs(undefined, [DAVISON, OKEEFE], { returnHome: true });
    expect(legs).toHaveLength(1);
    expect(legs[0]!.from.id).toBe("davison-orchards");
  });

  it("has no legs for one stop and no start", () => {
    expect(chainLegs(undefined, [DAVISON])).toEqual([]);
  });
});

describe("straightLeg and shownLeg", () => {
  it("measures a straight line between two placed ends, in km only", () => {
    const line = straightLeg(day[0]!);
    expect(line).toMatchObject({ kind: "straight-line", basis: "coordinates" });
    expect(line).not.toHaveProperty("minutes");
  });

  it("measures nothing when Atlas has not placed an end", () => {
    const unplaced = chainLegs(undefined, [
      DAVISON,
      { id: "x", name: "Somewhere" },
    ]);
    expect(straightLeg(unplaced[0]!)).toBeUndefined();
    expect(shownLeg(unplaced[0]!, undefined)).toBeUndefined();
  });

  it("prefers Atlas's answer, including an answer that there is no route", () => {
    expect(shownLeg(day[0]!, routed(9, 4.5))?.kind).toBe("routed");
    // "No route" is information: a straight line would hide it.
    expect(shownLeg(day[0]!, noRoute)?.kind).toBe("no-route");
    expect(shownLeg(day[0]!, undefined)?.kind).toBe("straight-line");
  });
});

describe("travelTotal", () => {
  it("adds up a day where every leg is routed", () => {
    const total = travelTotal(
      day,
      [routed(9, 4.5), routed(14, 11.8), routed(18, 19.6)],
      "driving",
    );
    expect(total).toEqual({
      kind: "complete",
      mode: "driving",
      minutes: 41,
      roadKm: 35.9,
      legs: 3,
    });
  });

  it("never fills a missing leg: it says at least, and names the leg", () => {
    const total = travelTotal(
      day,
      [routed(9, 4.5), noRoute, routed(18, 19.6)],
      "driving",
    );
    expect(total).toMatchObject({ kind: "partial", minutes: 27, routed: 2 });
    expect(total.kind === "partial" && total.missing).toEqual([
      "Davison Orchards → O'Keefe Ranch",
    ]);
    expect(describeTravelTotal(total)?.headline).toBe(
      "At least 27 min of driving",
    );
  });

  it("does not count a walk's minutes toward a drive", () => {
    const total = travelTotal(
      day,
      [routed(9, 4.5, "walking"), routed(14, 11.8), routed(18, 19.6)],
      "driving",
    );
    expect(total).toMatchObject({ kind: "partial", minutes: 32 });
  });

  it("does not count a route that may end inside a site, and says why", () => {
    // Atlas's Vernon probe: Kalamalka Lake Park's point is inside the park,
    // and OSRM reached it by tracks, 82 min for 12 km in a straight line.
    const toTheMiddle: Journey = {
      ...(routed(82, 33.3) as Journey & { kind: "routed" }),
      accessCaution:
        "the route averages 25 km/h over 33.3 km — the point may be inside the site, reached by minor tracks rather than its entrance",
    };
    const total = travelTotal(
      day,
      [routed(9, 4.5), toTheMiddle, routed(18, 19.6)],
      "driving",
    );
    expect(total).toEqual({
      kind: "partial",
      mode: "driving",
      minutes: 27,
      routed: 2,
      legs: 3,
      missing: [],
      cautioned: ["Davison Orchards → O'Keefe Ranch"],
    });
    const words = describeTravelTotal(total, 120);
    expect(words?.headline).toBe("At least 27 min of driving");
    expect(words?.caveat).toBe(
      "2 legs of 3 counted; not counted, because the route may end inside the site rather than at its entrance: Davison Orchards → O'Keefe Ranch. With 2 h at the stops, that is at least 2 h 27 min in all.",
    );
  });

  it("does not count a route to an area's interior point, even with no caution sent", () => {
    const areaPoint: Journey = {
      ...(routed(82, 33.3) as Journey & { kind: "routed" }),
      areaPoint: true,
    };
    const total = travelTotal(
      day,
      [routed(9, 4.5), areaPoint, routed(18, 19.6)],
      "driving",
    );
    expect(total).toMatchObject({
      kind: "partial",
      minutes: 27,
      cautioned: ["Davison Orchards → O'Keefe Ranch"],
    });
  });

  it("gives no figure when every routed leg is cautioned, and still names them", () => {
    const cautioned = {
      ...(routed(82, 33.3) as Journey & { kind: "routed" }),
      accessCaution: "the point may be inside the site",
    };
    const legs = day.slice(0, 1);
    const total = travelTotal(legs, [cautioned], "driving");
    expect(total).toMatchObject({ kind: "partial", minutes: 0, routed: 0 });
    const words = describeTravelTotal(total, 120);
    expect(words?.headline).toBe("No driving total to give");
    expect(words?.caveat).toBe(
      "0 legs of 1 counted; not counted, because the route may end inside the site rather than at its entrance: Vernon → Davison Orchards.",
    );
  });

  it("names a missing leg and a cautioned one separately", () => {
    const total = travelTotal(
      day,
      [
        routed(9, 4.5),
        noRoute,
        {
          ...(routed(40, 30) as Journey & { kind: "routed" }),
          accessCaution: "x",
        },
      ],
      "driving",
    );
    expect(describeTravelTotal(total)?.caveat).toBe(
      "1 leg of 3 counted; this one has no travel time: Davison Orchards → O'Keefe Ranch; not counted, because the route may end inside the site rather than at its entrance: O'Keefe Ranch → Vernon.",
    );
  });

  it("has no total at all when nothing was routed", () => {
    expect(
      travelTotal(day, [undefined, undefined, undefined], "driving"),
    ).toEqual({ kind: "none", legs: 3 });
    expect(describeTravelTotal({ kind: "none", legs: 3 })).toBeUndefined();
  });
});

describe("describeTravelTotal", () => {
  it("states the whole day as the plan's hours plus the routed travel", () => {
    const words = describeTravelTotal(
      { kind: "complete", mode: "driving", minutes: 72, roadKm: 60, legs: 4 },
      240,
    );
    expect(words?.headline).toBe("1 h 12 min of driving across 4 legs");
    expect(words?.caveat).toMatch(
      /With 4 h at the stops, that is about 5 h 12 min in all/,
    );
  });

  it("states a partial day's whole as a floor, too", () => {
    const words = describeTravelTotal(
      {
        kind: "partial",
        mode: "walking",
        minutes: 30,
        routed: 1,
        legs: 2,
        missing: ["A → B"],
        cautioned: [],
      },
      120,
    );
    expect(words?.headline).toBe("At least 30 min of walking");
    expect(words?.caveat).toMatch(
      /1 leg of 2 routed; this one has no travel time: A → B/,
    );
    expect(words?.caveat).toMatch(/at least 2 h 30 min in all/);
  });
});
