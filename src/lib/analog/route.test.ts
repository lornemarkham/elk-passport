import { describe, expect, it } from "vitest";
import { buildDay } from "@/domain/day/build";
import { readBrief } from "@/domain/day/brief";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import type { DiscoveryCandidate } from "@/lib/data/types";
import { townById } from "@/domain/discovery/towns";
import { legsFor, routeFor, sketchFor, type RoutedTravel } from "./route";
import { printableFromDay } from "./printable";

const VERNON = townById("vernon")!;

// Fixtures, not Atlas. `north` and `east` are km from Vernon's centre.
const place = (
  name: string,
  at: { north: number; east?: number } | null,
): DiscoveryCandidate => ({
  id: name.toLowerCase().replace(/\W+/g, "-"),
  kind: "Place",
  name,
  subtype: name,
  description: "A description long enough to be real.",
  mediaCount: 0,
  containsCount: 0,
  regionIds: [],
  geography: {
    state: "observed",
    locality: "Vernon",
    area: { id: "okanagan", name: "Okanagan" },
    ...(at
      ? {
          coordinates: [
            VERNON.longitude +
              (at.east ?? 0) /
                (111.2 * Math.cos((VERNON.latitude * Math.PI) / 180)),
            VERNON.latitude + at.north / 111.2,
          ] as [number, number],
        }
      : {}),
  },
});

/** A day in exactly this order, from Vernon. */
const dayOf = (pool: DiscoveryCandidate[], said = "Four hours near Vernon") => {
  const experiences = pool.map(candidateToExperience);
  const day = buildDay({ pool: experiences, brief: readBrief(said) });
  // The builder orders nearest-first; tests pin the order they describe.
  const byId = new Map(day.stops.map((s) => [s.experience.id, s]));
  return {
    ...day,
    stops: experiences.map((e) => byId.get(e.id)!).filter(Boolean),
  };
};

describe("legsFor", () => {
  it("runs from the start, between stops, and home", () => {
    const day = dayOf([
      place("North Park", { north: 3 }),
      place("Far Park", { north: 7 }),
    ]);
    const legs = legsFor(day);
    expect(legs.map((l) => [l.from, l.to, l.home ?? false])).toEqual([
      ["Vernon", "North Park", false],
      ["North Park", "Far Park", false],
      ["Far Park", "Vernon", true],
    ]);
    expect(legs[0]!.km).toBeCloseTo(3, 0);
    expect(legs[1]!.km).toBeCloseTo(4, 0);
    expect(legs[2]!.km).toBeCloseTo(7, 0);
  });

  it("gives no distance to a leg with an unplaced end, nor to the one after it", () => {
    // The builder measures stop 3 from stop 1 when stop 2 has no position.
    // On paper that leg is "from stop 2", so it has no honest distance.
    const day = dayOf([
      place("North Park", { north: 3 }),
      place("Nowhere Hall", null),
      place("Far Park", { north: 7 }),
    ]);
    const legs = legsFor(day);
    expect(legs[1]!.to).toBe("Nowhere Hall");
    expect(legs[1]!.km).toBeUndefined();
    expect(legs[2]!.from).toBe("Nowhere Hall");
    expect(legs[2]!.km).toBeUndefined();
    const printable = printableFromDay(day);
    expect(printable.stops[2]!.km).toBeUndefined();
    expect(printable.time.unmeasuredLegs).toBe(2);
  });

  it("has no legs from a start nobody gave, and no way home", () => {
    const day = dayOf(
      [place("North Park", { north: 3 }), place("Far Park", { north: 7 })],
      "Four hours outside",
    );
    const legs = legsFor(day);
    expect(legs).toHaveLength(1);
    expect(legs[0]!.from).toBe("North Park");
    expect(legs.some((l) => l.home)).toBe(false);
  });

  it("carries a routed time only where one was handed in", () => {
    const day = dayOf([
      place("North Park", { north: 3 }),
      place("Far Park", { north: 7 }),
    ]);
    const routed: RoutedTravel = {
      kind: "routed",
      mode: "driving",
      minutes: 9,
      roadKm: 5.2,
      provider: "openrouteservice",
    };
    const legs = legsFor(day, { travel: { "far-park": routed } });
    expect(legs[0]!.routed).toBeUndefined();
    expect(legs[1]!.routed).toEqual(routed);
    expect(legs[2]!.routed).toBeUndefined();
  });
});

describe("routeFor", () => {
  const day = dayOf([
    place("North Park", { north: 3 }),
    place("Far Park", { north: 7 }),
  ]);

  it("credits nobody when no routed time is printed", () => {
    expect(routeFor(day).attribution).toEqual([]);
  });

  it("credits the provider of every routed time, preferring the caller's lines", () => {
    const travel = {
      home: {
        kind: "routed" as const,
        mode: "driving",
        minutes: 11,
        roadKm: 8,
        provider: "openrouteservice",
      },
    };
    expect(routeFor(day, { travel }).attribution).toEqual([
      "Travel times by openrouteservice",
    ]);
    expect(
      routeFor(day, { travel, attribution: ["Routes © openrouteservice.org"] })
        .attribution,
    ).toEqual(["Routes © openrouteservice.org"]);
  });

  it("names what is not on the sketch, and only closes the loop when nothing is missing", () => {
    const partial = dayOf([
      place("North Park", { north: 3 }),
      place("Nowhere Hall", null),
      place("Far Park", { north: 7 }),
    ]);
    const route = routeFor(partial);
    expect(route.unplaced).toEqual(["Nowhere Hall"]);
    expect(route.sketch?.points).toHaveLength(3);
    expect(route.sketch?.loops).toBe(false);
    expect(routeFor(day).sketch?.loops).toBe(true);
  });

  it("draws nothing when fewer than two points are placed", () => {
    const lonely = dayOf(
      [place("North Park", { north: 3 }), place("Nowhere Hall", null)],
      "Four hours outside",
    );
    expect(routeFor(lonely).sketch).toBeUndefined();
  });
});

describe("sketchFor", () => {
  const at = (north: number, east: number) => ({
    latitude: VERNON.latitude + north / 111.2,
    longitude:
      VERNON.longitude +
      east / (111.2 * Math.cos((VERNON.latitude * Math.PI) / 180)),
  });

  it("puts north up and keeps true proportions", () => {
    const sketch = sketchFor(
      [
        { label: "Start", at: at(0, 0) },
        { label: "North", number: 1, at: at(10, 0) },
        { label: "East", number: 2, at: at(0, 5) },
      ],
      false,
    )!;
    const [start, north, east] = sketch.points;
    expect(north!.y).toBeLessThan(start!.y);
    expect(east!.x).toBeGreaterThan(start!.x);
    // 10 km north and 5 km east draw in a 2:1 ratio, give or take rounding.
    const up = start!.y - north!.y;
    const across = east!.x - start!.x;
    expect(up / across).toBeCloseTo(2, 1);
  });

  it("draws a scale bar that is the right length for what it says", () => {
    const sketch = sketchFor(
      [
        { label: "Start", at: at(0, 0) },
        { label: "North", number: 1, at: at(10, 0) },
      ],
      false,
    )!;
    const [start, north] = sketch.points;
    const pxPerKm = (start!.y - north!.y) / 10;
    expect(sketch.scale.px / sketch.scale.km).toBeCloseTo(pxPerKm, 0);
    expect(sketch.scale.px).toBeLessThanOrEqual(sketch.width / 4 + 1);
  });

  it("keeps every point inside the frame", () => {
    const sketch = sketchFor(
      [
        { label: "A", at: at(0, 0) },
        { label: "B", number: 1, at: at(40, -30) },
        { label: "C", number: 2, at: at(-12, 25) },
      ],
      true,
    )!;
    for (const p of sketch.points) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(sketch.width);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(sketch.height);
    }
  });

  it("does not divide by zero when two points coincide", () => {
    const sketch = sketchFor(
      [
        { label: "A", at: at(0, 0) },
        { label: "B", number: 1, at: at(0, 0) },
      ],
      false,
    )!;
    for (const p of sketch.points) {
      expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
    }
    expect(Number.isFinite(sketch.scale.px)).toBe(true);
  });
});
