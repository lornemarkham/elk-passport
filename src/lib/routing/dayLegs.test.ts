import { describe, expect, it } from "vitest";
import type { DayPlanned } from "@/domain/day/build";
import { DRIVE_TIMES_UNKNOWN } from "@/domain/day/build";
import type { Experience } from "@/domain/experience/types";
import { townById } from "@/domain/discovery/towns";
import { dayLegs, unknownsWithTravel } from "./dayLegs";

const VERNON = townById("vernon")!;

const stop = (id: string, coordinates?: [number, number]) => ({
  experience: {
    id,
    title: id,
    ...(coordinates ? { geography: { coordinates } } : {}),
  } as unknown as Experience,
  minutes: 60,
  because: "",
  notes: [],
});

const day = (town: boolean, ...stops: ReturnType<typeof stop>[]) =>
  ({
    title: "",
    opening: "",
    stops,
    unknowns: ["Prices", DRIVE_TIMES_UNKNOWN],
    brief: { said: "", ...(town ? { town: VERNON } : {}) },
    closing: "",
  }) as unknown as DayPlanned;

describe("dayLegs", () => {
  it("starts at the town's centre, arrives at each stop, and comes home", () => {
    const { legs, into, home } = dayLegs(
      day(true, stop("a", [-119.29, 50.28]), stop("b", [-119.28, 50.36])),
    );
    expect(legs.map((l) => `${l.from.name}→${l.to.name}`)).toEqual([
      "Vernon→a",
      "a→b",
      "b→Vernon",
    ]);
    // A start is not an Atlas subject: it carries no id.
    expect(legs[0]!.from.id).toBeUndefined();
    expect(into).toEqual([0, 1]);
    expect(home).toBe(2);
  });

  it("has no leg into the first stop, and no way home, without a town", () => {
    const { legs, into, home } = dayLegs(
      day(false, stop("a", [-119.29, 50.28]), stop("b", [-119.28, 50.36])),
    );
    expect(legs).toHaveLength(1);
    expect(into).toEqual([undefined, 0]);
    expect(home).toBeUndefined();
  });
});

describe("unknownsWithTravel", () => {
  const unknowns = ["Prices", DRIVE_TIMES_UNKNOWN];

  it("drops the drive-times line once every leg is routed", () => {
    expect(
      unknownsWithTravel(unknowns, "ready", {
        kind: "complete",
        mode: "driving",
        minutes: 41,
        roadKm: 30,
        legs: 3,
      }),
    ).toEqual(["Prices"]);
  });

  it("names the legs still without a time", () => {
    expect(
      unknownsWithTravel(unknowns, "ready", {
        kind: "partial",
        mode: "driving",
        minutes: 27,
        routed: 2,
        legs: 3,
        missing: ["a → b"],
      })[1],
    ).toMatch(/Travel time for a → b/);
  });

  it("keeps it while Atlas has not routed anything", () => {
    for (const status of ["loading", "not-served", "failed"] as const) {
      expect(
        unknownsWithTravel(unknowns, status, { kind: "none", legs: 3 }),
      ).toEqual(unknowns);
    }
  });
});
