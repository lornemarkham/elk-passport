import { describe, expect, it } from "vitest";
import { printTravel } from "./travel";
import { legsFor } from "@/lib/analog/route";
import { chainLegs } from "@/lib/routing/legs";
import { legsAnswerFrom } from "@/lib/routing/atlasLegs";
import {
  DAVISON,
  LEGS_DRIVING_MOCK,
  OKEEFE,
  VERNON_START,
} from "@/lib/routing/fixtures";

const legs = chainLegs(VERNON_START, [DAVISON, OKEEFE], { returnHome: true });
const answer = legsAnswerFrom(LEGS_DRIVING_MOCK, 3, "driving");
const journeys = answer.state === "ready" ? answer.journeys : [];

describe("printTravel — maps' answer, in the field guide's terms", () => {
  it("keys each routed leg by the stop it arrives at, and home", () => {
    const options = printTravel(legs, journeys, "ready", "driving");
    expect(Object.keys(options.travel ?? {})).toEqual([
      "davison-orchards",
      "okeefe-ranch",
      "home",
    ]);
    expect(options.travel?.["davison-orchards"]).toMatchObject({
      minutes: 9,
      roadKm: 4.5,
    });
    expect(options.attribution?.length).toBeGreaterThan(0);
    expect(options.travelTotal?.headline).toMatch(/driving/);
  });

  it("never prints a route to the middle of a park bare", () => {
    const cautioned = journeys.map((j, i) =>
      i === 0 && j?.kind === "routed"
        ? { ...j, accessCaution: "the point is inside the park" }
        : j,
    );
    const options = printTravel(legs, cautioned, "ready", "driving");
    expect(options.travel?.["davison-orchards"]?.accessCaution).toBeDefined();
    // And the total does not count it.
    expect(options.travelTotal?.headline).toMatch(/^At least/);
  });

  it("prints an area point's caution even when Atlas sent only the flag", () => {
    const area = journeys.map((j, i) =>
      i === 0 && j?.kind === "routed" ? { ...j, areaPoint: true as const } : j,
    );
    const options = printTravel(legs, area, "ready", "driving");
    expect(options.travel?.["davison-orchards"]?.accessCaution).toMatch(
      /not at the way in/,
    );
    expect(options.travelTotal?.headline).toMatch(/^At least/);
  });

  it("prints no time, and says why, when Atlas did not answer", () => {
    for (const status of ["not-served", "failed"] as const) {
      const options = printTravel(
        legs,
        legs.map(() => undefined),
        status,
        "driving",
      );
      expect(options.travel).toEqual({});
      expect(options.travelTotal).toBeUndefined();
      expect(options.travelNote).toMatch(/Atlas/);
    }
  });

  it("lines up with the legs the field guide prints", async () => {
    const { buildDay } = await import("@/domain/day/build");
    const { readBrief } = await import("@/domain/day/brief");
    const day = buildDay({ pool: [], brief: readBrief("near Vernon") });
    // An empty day still has to agree on keys: none.
    expect(legsFor(day, printTravel([], [], "ready", "driving"))).toEqual([]);
  });
});
