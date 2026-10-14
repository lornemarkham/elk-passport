import { describe, expect, it } from "vitest";
import { assessFeasibility, legsOf, NO_ROUTING, type Leg } from "./feasibility";
import { anAdventure, north, subjectMoment } from "./fixtures";

const at = (km: number) => ({
  state: "known" as const,
  value: north(km),
  source: { by: "atlas" as const },
});

describe("legsOf", () => {
  it("measures straight-line hops from the origin and never claims minutes", () => {
    const legs = legsOf(
      anAdventure({
        moments: [
          subjectMoment("a1", { point: at(10) }),
          subjectMoment("a2", { point: at(30) }),
        ],
      }),
    );
    expect(legs.map((l) => [l.from, l.to])).toEqual([
      ["origin", "a1"],
      ["a1", "a2"],
    ]);
    expect(legs[0]!.straightLineKm).toMatchObject({
      state: "known",
      value: 10,
    });
    expect(legs[1]!.straightLineKm).toMatchObject({
      state: "known",
      value: 20,
    });
    for (const leg of legs) {
      expect(leg.travelMinutes).toEqual({
        state: "unknown",
        because: NO_ROUTING,
      });
    }
  });

  it("does not pretend to know where you are after an unplaced stop", () => {
    const legs = legsOf(
      anAdventure({
        moments: [
          subjectMoment("a1", {
            point: { state: "unknown", because: "Atlas has not placed this." },
          }),
          subjectMoment("a2", { point: at(5) }),
        ],
      }),
    );
    expect(legs.map((l) => l.straightLineKm.state)).toEqual([
      "unknown",
      "unknown",
    ]);
  });

  it("steps over free time, which has no place", () => {
    const legs = legsOf(
      anAdventure({
        moments: [
          subjectMoment("a1", { point: at(4) }),
          { kind: "free", id: "lunch", label: "Lunch", minutes: 45, notes: [] },
          subjectMoment("a2", { point: at(6) }),
        ],
      }),
    );
    expect(legs.map((l) => [l.from, l.to])).toEqual([
      ["origin", "a1"],
      ["a1", "a2"],
    ]);
  });
});

describe("assessFeasibility", () => {
  it("says unknown, not fits, for a day whose driving it cannot time", () => {
    const f = assessFeasibility(anAdventure());
    expect(f.time.verdict).toBe("fits");
    expect(f.travel.verdict).toBe("unknown");
    expect(f.travel.because).toContain("120 minutes left");
    expect(f.travel.because).toContain(NO_ROUTING);
    expect(f.verdict).toBe("unknown");
  });

  it("knows stops alone can overrun the time", () => {
    const f = assessFeasibility(
      anAdventure({
        constraints: { ...anAdventure().constraints, time: { hours: 1 } },
      }),
    );
    expect(f.time.verdict).toBe("does-not-fit");
    expect(f.verdict).toBe("does-not-fit");
  });

  it("knows a day with no minutes left cannot drive anywhere", () => {
    const f = assessFeasibility(
      anAdventure({
        constraints: { ...anAdventure().constraints, time: { hours: 2 } },
      }),
    );
    expect(f.time.verdict).toBe("fits");
    expect(f.travel.verdict).toBe("does-not-fit");
  });

  it("rules out a stop past the stated radius, because no road is shorter", () => {
    const f = assessFeasibility(
      anAdventure({
        constraints: { ...anAdventure().constraints, withinKm: 15 },
        moments: [subjectMoment("far", { point: at(40) })],
      }),
    );
    expect(f.travel.verdict).toBe("does-not-fit");
    expect(f.travel.because).toContain("past the 15 km");
  });

  it("cannot confirm a radius for a stop Atlas has not placed", () => {
    const f = assessFeasibility(
      anAdventure({
        constraints: {
          ...anAdventure().constraints,
          time: {},
          withinKm: 15,
        },
        moments: [
          subjectMoment("near", { point: at(3) }),
          subjectMoment("nowhere", {
            point: { state: "unknown", because: "Atlas has not placed this." },
          }),
        ],
      }),
    );
    expect(f.travel.verdict).toBe("unknown");
  });

  it("counts drive time only from a named routing provider", () => {
    const adventure = anAdventure();
    const legs = legsOf(adventure);
    const claimed = (by: "routing" | "model"): Leg[] =>
      legs.map((l) => ({
        ...l,
        travelMinutes: {
          state: "known",
          value: 10,
          source: by === "routing" ? { by, provider: "test" } : { by },
        },
      }));
    expect(
      assessFeasibility(adventure, claimed("routing")).travel.verdict,
    ).toBe("fits");
    // A model's guess at a drive time is not a drive time.
    expect(assessFeasibility(adventure, claimed("model")).travel.verdict).toBe(
      "unknown",
    );
  });

  it("reads schedule only for the chosen day", () => {
    const on = "2026-10-17";
    const open = (date: string, isOpen: boolean) => ({
      state: "known" as const,
      value: { date, open: isOpen },
      source: { by: "atlas" as const, contract: "candidate-schedule/1" },
    });
    const withOn = (moments: ReturnType<typeof subjectMoment>[]) =>
      anAdventure({
        constraints: { ...anAdventure().constraints, time: { hours: 4, on } },
        moments,
      });

    expect(
      assessFeasibility(withOn([subjectMoment("x", { open: open(on, false) })]))
        .schedule.verdict,
    ).toBe("does-not-fit");
    expect(
      assessFeasibility(withOn([subjectMoment("x", { open: open(on, true) })]))
        .schedule.verdict,
    ).toBe("fits");
    // Evidence about another day says nothing about this one.
    expect(
      assessFeasibility(
        withOn([subjectMoment("x", { open: open("2026-10-18", true) })]),
      ).schedule.verdict,
    ).toBe("unknown");
    expect(assessFeasibility(anAdventure()).schedule.verdict).toBe("unknown");
  });

  it("totals only prices that are totals", () => {
    const free = {
      state: "known" as const,
      value: { text: "Free", dollars: 0 },
      source: { by: "atlas" as const },
    };
    const perHead = {
      state: "known" as const,
      value: { text: "$12 for adults" },
      source: { by: "atlas" as const },
    };
    const budget = (moments: ReturnType<typeof subjectMoment>[]) =>
      assessFeasibility(
        anAdventure({
          constraints: {
            ...anAdventure().constraints,
            budget: { maxDollars: 20 },
          },
          moments,
        }),
      ).budget;

    expect(budget([subjectMoment("a", { cost: free })]).verdict).toBe("fits");
    expect(budget([subjectMoment("a", { cost: perHead })]).verdict).toBe(
      "unknown",
    );
    expect(
      budget([
        subjectMoment("a", {
          cost: { ...free, value: { text: "$30 a family", dollars: 30 } },
        }),
        subjectMoment("b"),
      ]).verdict,
    ).toBe("does-not-fit");
    expect(assessFeasibility(anAdventure()).budget.verdict).toBe(
      "unconstrained",
    );
  });

  it("stops only on a stated age rule, and admits it cannot check needs", () => {
    const withChild = (
      suitability: ReturnType<typeof subjectMoment>["suitability"],
      needs: string[] = [],
    ) =>
      assessFeasibility(
        anAdventure({
          constraints: {
            ...anAdventure().constraints,
            party: { companions: [{ role: "child", age: 5 }], needs },
          },
          moments: [subjectMoment("x", { suitability })],
        }),
      ).party;
    const verdict = (v: "excluded" | "welcome") => ({
      state: "known" as const,
      value: { age: 5, verdict: v },
      source: { by: "atlas" as const },
    });

    expect(withChild(verdict("excluded")).verdict).toBe("does-not-fit");
    expect(withChild(verdict("welcome")).verdict).toBe("fits");
    expect(withChild(undefined).verdict).toBe("unknown");
    const needs = withChild(verdict("welcome"), ["allergic to shellfish"]);
    expect(needs.verdict).toBe("unknown");
    expect(needs.because).toContain("allergic to shellfish");
  });

  it("fits only when every check fits or had nothing to check", () => {
    const f = assessFeasibility(
      anAdventure({
        constraints: {
          ...anAdventure().constraints,
          time: { on: "2026-10-17" },
        },
        moments: [
          subjectMoment("x", {
            open: {
              state: "known",
              value: { date: "2026-10-17", open: true },
              source: { by: "atlas" },
            },
          }),
        ],
      }),
    );
    expect(f.verdict).toBe("fits");
  });
});
