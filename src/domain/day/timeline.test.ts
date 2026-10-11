import { describe, expect, it } from "vitest";
import type { DayPlanned } from "./build";
import type { Experience } from "@/domain/experience/types";
import type { Journey } from "@/lib/routing/journey";
import { townById } from "@/domain/discovery/towns";
import { timelineFor } from "./timeline";

const stop = (id: string, minutes: number, c: [number, number]) => ({
  experience: {
    id,
    kind: "Place",
    slug: id,
    title: id,
    geography: { coordinates: c },
  } as unknown as Experience,
  minutes,
  because: "",
  notes: [],
});

const day = (brief: object): DayPlanned =>
  ({
    title: "t",
    opening: "",
    stops: [stop("a", 60, [-119.29, 50.28]), stop("b", 90, [-119.28, 50.36])],
    unknowns: [],
    budget: { perMove: 15 },
    brief: { said: "x", town: townById("vernon")!, ...brief },
    closing: "",
  }) as unknown as DayPlanned;

const routed = (minutes: number): Journey => ({
  kind: "routed",
  mode: "driving",
  minutes,
  roadKm: 10,
  straightKm: 8,
  provider: "mock",
  calculatedAt: "2026-10-11T00:00:00Z",
  limitations: [],
});

describe("timelineFor", () => {
  it("says nothing without a leaving time", () => {
    expect(timelineFor(day({}), [], "driving")).toBeUndefined();
  });

  it("with no routes, every time is 'about', built on the plan's allowance", () => {
    const t = timelineFor(day({ startAt: 600 }), [], "driving")!;
    // 10:00 + 15 buffer, 60 at a, + 15, 90 at b, + 15 home.
    expect(t.stops.map((s) => [s.arrive, s.leave])).toEqual([
      [615, 675],
      [690, 780],
    ]);
    expect(t.home?.arrive).toBe(795);
    expect(t.basis).toBe("allowance");
    expect(t.stops.every((s) => s.basis === "allowance")).toBe(true);
  });

  it("uses Atlas's routed minutes in place of the buffer, and only those", () => {
    const t = timelineFor(
      day({ startAt: 600, homeBy: 840 }),
      [routed(10), routed(30), undefined],
      "driving",
    )!;
    expect(t.stops[0]).toMatchObject({
      arrive: 610,
      leave: 670,
      basis: "routed",
    });
    expect(t.stops[1]).toMatchObject({
      arrive: 700,
      leave: 790,
      basis: "routed",
    });
    // The way home was not routed: the day ends on an allowance, and says so.
    expect(t.home).toMatchObject({ arrive: 805, basis: "allowance" });
    expect(t.verdict).toBe("tight");
    expect(t.slack).toBe(35);
  });

  it("is ok only when everything is routed and there is room", () => {
    const t = timelineFor(
      day({ startAt: 600, homeBy: 900 }),
      [routed(10), routed(30), routed(20)],
      "driving",
    )!;
    expect(t.basis).toBe("routed");
    expect(t.verdict).toBe("ok");
  });

  it("is over when even the measured and planned minutes pass home-by", () => {
    const t = timelineFor(
      day({ startAt: 600, homeBy: 700 }),
      [routed(10), routed(30), routed(20)],
      "driving",
    )!;
    expect(t.verdict).toBe("over");
    expect(t.slack!).toBeLessThan(0);
  });

  it("does not count a walk's minutes as a drive's", () => {
    const walk = { ...routed(500), mode: "walking" } as Journey;
    const t = timelineFor(day({ startAt: 600 }), [walk], "driving")!;
    expect(t.stops[0]!.arrive).toBe(615);
  });

  it("says when it is counting from now rather than from a time they said", () => {
    expect(timelineFor(day({ startAt: 600 }), [], "driving")!.fromNow).toBe(
      false,
    );
    expect(
      timelineFor(day({ startAt: 600, startsNow: true }), [], "driving")!
        .fromNow,
    ).toBe(true);
  });
});
