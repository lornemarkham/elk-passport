import { describe, expect, it } from "vitest";
import { buildDay } from "./build";
import { readBrief } from "./brief";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import type { DiscoveryCandidate } from "@/lib/data/types";
import { townById } from "@/domain/discovery/towns";

/**
 * **Scenario A, in the domain**: four things somebody chose near Vernon are
 * four stops in the day, whatever else is around, however short the day —
 * and when they do not fit the hours, the day says so first.
 */
const VERNON = townById("vernon")!;
const place = (name: string, km: number, subtype = "park") =>
  ({
    id: name.toLowerCase().replace(/\W+/g, "-"),
    kind: "Place",
    name,
    subtype,
    description: "A description long enough to be real.",
    mediaCount: 0,
    containsCount: 0,
    regionIds: [],
    geography: {
      state: "observed",
      locality: "Vernon",
      area: { id: "okanagan", name: "Okanagan" },
      coordinates: [VERNON.longitude, VERNON.latitude + km / 111],
    },
  }) as DiscoveryCandidate;

const chosen = [
  place("Kal Beach", 6, "beach"),
  place("BNA Brewing", 2, "brewery"),
  place("Bean Scene Coffeehouse", 1, "coffee shop"),
  place("Predator Ridge Trail", 12, "trail"),
];
const others = Array.from({ length: 12 }, (_, i) =>
  place(`Other Park ${i}`, 1 + i),
);
const pool = [...chosen, ...others].map(candidateToExperience);
const ids = chosen.map((c) => c.id);

const build = (said: string) =>
  buildDay({
    pool,
    brief: readBrief(said, { town: VERNON }),
    keep: ids,
    picked: ids,
  });

describe("a day built from four chosen places", () => {
  for (const said of [
    "a day near Vernon",
    "four hours near Vernon",
    "two hours near Vernon",
    "all day near Vernon",
  ]) {
    it(`keeps all four for "${said}"`, () => {
      const day = build(said);
      for (const id of ids)
        expect(day.stops.map((s) => s.experience.id)).toContain(id);
    });
  }

  it("says it is tight before showing a squeezed day as finished", () => {
    const day = build("two hours near Vernon");
    expect(day.budget?.overBy).toBeGreaterThan(0);
    expect(day.conflicts?.join(" ")).toMatch(/4 stops need about/);
    expect(day.conflicts?.join(" ")).toMatch(/still here/);
    expect(day.leftOut).toBeUndefined();
  });

  it("has no conflict when the hours hold the picks", () => {
    expect(build("all day near Vernon").conflicts).toBeUndefined();
  });
});
