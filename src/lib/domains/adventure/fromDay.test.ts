import { describe, expect, it } from "vitest";
import { buildDay } from "@/domain/day/build";
import { readBrief } from "@/domain/day/brief";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import { townById } from "@/domain/discovery/towns";
import type { DiscoveryCandidate } from "@/lib/data/types";
import { adventureSchema } from "./contracts";
import { assessFeasibility, legsOf } from "./feasibility";
import { adventureFromDay } from "./fromDay";

const VERNON = townById("vernon")!;

const place = (
  name: string,
  km: number,
  over: Partial<DiscoveryCandidate> = {},
): DiscoveryCandidate => ({
  id: name.toLowerCase().replace(/\W+/g, "-"),
  kind: "Place",
  name,
  subtype: "park",
  description: "A description long enough to be real.",
  mediaCount: 0,
  containsCount: 0,
  regionIds: [],
  geography: {
    state: "observed",
    locality: "Vernon",
    area: { id: "okanagan", name: "Okanagan" },
    coordinates: [VERNON.longitude, VERNON.latitude + km / 111],
    coordinatesBasis: "observed",
  },
  ...over,
});

const aff = (...names: string[]) =>
  names.map((name) => ({ name, basis: "stated-activity" }));

const POOL = [
  place("Polson Park", 1, {
    knowledge: {
      affordances: aff("playground", "picnic"),
      practical: [{ label: "Admission", value: "Free" }],
      conditions: ["Dogs on leash"],
    },
    suitability: {
      stated: "stated",
      statements: [
        {
          about: "age",
          says: "all-ages",
          strength: "characterisation",
          text: "Fun for all ages",
          basis: "stated",
        },
      ],
      forAge: { age: 5, reading: "stated", because: [0] },
    },
  }),
  place("Okanagan Science Centre", 2, {
    subtype: "science centre",
    knowledge: {
      affordances: aff("interactive exhibits"),
      practical: [{ label: "Admission", value: "$12 for adults" }],
    },
  }),
  place("Kal Beach", 6, { knowledge: { affordances: aff("swimming") } }),
].map(candidateToExperience);

const DAY = buildDay({
  pool: POOL,
  brief: readBrief("four hours, $40, with a five-year-old near Vernon", {
    on: "2026-10-17",
  }),
});

const adventure = adventureFromDay(DAY, {
  id: "adv-1",
  createdAt: "2026-10-11T15:00:00.000Z",
})!;

describe("adventureFromDay", () => {
  it("produces a valid adventure from the day buildDay built", () => {
    expect(adventureSchema.safeParse(adventure).success).toBe(true);
    expect(adventure.moments.map((m) => m.id)).toEqual(
      DAY.stops.map((s) => s.experience.id),
    );
    expect(adventure.moments.map((m) => m.minutes)).toEqual(
      DAY.stops.map((s) => s.minutes),
    );
    expect(adventure.builtBy).toEqual({ by: "plan", method: "buildDay" });
  });

  it("carries what was said as constraints, and nothing that was not", () => {
    expect(adventure.said).toBe(DAY.brief.said);
    expect(adventure.constraints.time).toEqual({ hours: 4, on: "2026-10-17" });
    expect(adventure.constraints.budget).toEqual({ maxDollars: 40 });
    expect(adventure.constraints.party.companions).toEqual([
      { role: "child", age: 5 },
    ]);
    expect(adventure.constraints.origin).toMatchObject({ townId: "vernon" });
  });

  it("turns Atlas's lon-first tuple round exactly once", () => {
    const polson = adventure.moments.find((m) => m.id === "polson-park")!;
    if (polson.kind !== "subject") throw new Error("expected a subject");
    expect(polson.point).toMatchObject({
      state: "known",
      value: {
        latitude: VERNON.latitude + 1 / 111,
        longitude: VERNON.longitude,
      },
      basis: "observed",
    });
  });

  it("labels every reading with its source, and silence as silence", () => {
    const byId = new Map(adventure.moments.map((m) => [m.id, m]));
    const polson = byId.get("polson-park")!;
    const science = byId.get("okanagan-science-centre")!;
    const beach = byId.get("kal-beach")!;
    if (
      polson.kind !== "subject" ||
      science.kind !== "subject" ||
      beach.kind !== "subject"
    )
      throw new Error("expected subjects");

    expect(polson.cost).toEqual({
      state: "known",
      value: { text: "Free", dollars: 0 },
      source: { by: "atlas", contract: "candidate-knowledge/1" },
    });
    // A per-adult price is a price, not a total for the party.
    expect(science.cost).toMatchObject({
      state: "known",
      value: { text: "$12 for adults" },
    });
    expect(science.cost.state === "known" && science.cost.value.dollars).toBe(
      undefined,
    );
    expect(beach.cost.state).toBe("unknown");
    expect(beach.open.state).toBe("unknown");
    expect(polson.suitability).toMatchObject({
      state: "known",
      value: { age: 5, verdict: "welcome" },
      basis: "Fun for all ages",
    });
    expect(beach.suitability?.state).toBe("unknown");
    expect(polson.notes).toContain("Dogs on leash");
  });

  it("measures the same hops buildDay printed", () => {
    const legs = legsOf(adventure);
    expect(legs.map((l) => l.straightLineKm)).toEqual(
      DAY.stops.map((s) => ({
        state: "known",
        value: s.km,
        source: { by: "plan", method: "haversine" },
      })),
    );
  });

  it("cannot call a day with unknown prices and hours a fit", () => {
    const f = assessFeasibility(adventure);
    expect(f.time.verdict).toBe("fits");
    expect(f.budget.verdict).toBe("unknown");
    expect(f.schedule.verdict).toBe("unknown");
    expect(f.verdict).toBe("unknown");
  });

  it("has nothing to save for an empty day", () => {
    const empty = buildDay({ pool: [], brief: readBrief("two hours") });
    expect(
      adventureFromDay(empty, { id: "x", createdAt: "2026-10-11T15:00:00Z" }),
    ).toBeUndefined();
  });
});
