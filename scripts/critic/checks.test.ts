import { describe, expect, it } from "vitest";
import type { DayPlanned, DayStop } from "@/domain/day/build";
import type { DiscoveryCandidate } from "@/lib/data/types";
import type { Experience } from "@/domain/experience/types";
import { readBrief } from "@/domain/day/brief";
import { townById } from "@/domain/discovery/towns";
import { examine, score, type DayEvidence } from "./checks";
import { compare, type Run } from "./compare";
import type { Scenario } from "./cohort";

const VERNON = townById("vernon")!;
const origin = { latitude: VERNON.latitude, longitude: VERNON.longitude };

const candidate = (
  id: string,
  km: number,
  over: Partial<DiscoveryCandidate> = {},
): DiscoveryCandidate => ({
  id,
  kind: "Place",
  name: id,
  subtype: "park",
  description: "x",
  mediaCount: 0,
  containsCount: 0,
  regionIds: [],
  geography: {
    state: "observed",
    coordinates: [VERNON.longitude, VERNON.latitude + km / 111],
  },
  ...over,
});

const stop = (c: DiscoveryCandidate, minutes = 60): DayStop => ({
  experience: {
    id: c.id,
    kind: "place",
    title: c.name,
    geography: c.geography,
    knowledge: { affordances: [{ name: "walking", basis: "offers" }] },
  } as unknown as Experience,
  minutes,
  because: "because",
  notes: [],
});

const scenario = (over: Partial<Scenario> = {}): Scenario => ({
  id: "s",
  town: "vernon",
  says: "three free hours",
  brief: "Three free hours",
  hears: { hours: 3 },
  needs: { fitsHours: 3 },
  ...over,
});

const evidence = (
  stops: DiscoveryCandidate[],
  over: Partial<DayEvidence> = {},
): DayEvidence => {
  const ids = stops.map((s) => s.id);
  const day: DayPlanned = {
    title: "t",
    opening: "3 hours, 2 stops inside 30 km of Vernon, and a plan.",
    stops: stops.map((s) => stop(s)),
    unknowns: [],
    brief: readBrief("three free hours", { town: VERNON }),
    closing: "c",
  };
  return {
    scenario: scenario(),
    origin,
    brief: day.brief,
    day,
    oracle: {
      byId: new Map(stops.map((s) => [s.id, s])),
      onDate: "2026-10-11",
    },
    ledger: {},
    screenIds: ids,
    printIds: ids,
    screenText: "fine",
    printText: "fine",
    poolIds: new Set(ids),
    printMapLinks: ids.length,
    ...over,
  };
};

describe("examine", () => {
  it("fails a reading only on what was said", () => {
    const r = examine(evidence([candidate("a", 1), candidate("b", 2)]));
    expect(r.findings.map((f) => f.check)).toEqual(["reading.hours"]);
  });

  it("fails a stop on Atlas's stated date, and never on its silence", () => {
    const shut = candidate("shut", 1, {
      schedule: {
        stated: "stated",
        onDate: {
          date: "2026-10-11",
          reading: "not-on",
          basis: "stated-season",
        },
      },
    });
    const silent = candidate("silent", 2, {
      schedule: {
        stated: "unknown",
        onDate: { date: "2026-10-11", reading: "unknown", basis: "none" },
      },
    });
    const r = examine(evidence([shut, silent]));
    const dated = r.findings.filter((f) => f.check === "stop.not-on-date");
    expect(dated.map((f) => f.subject)).toEqual(["shut"]);
    expect(r.signals.dateKnown).toBe(1);
  });

  it("says a day doesn't fit when even the fastest drive leaves no time", () => {
    const far = [candidate("a", 90), candidate("b", 95)];
    const r = examine(evidence(far));
    expect(r.findings.some((f) => f.check === "day.does-not-fit")).toBe(true);
  });

  it("catches paper that is not the screen", () => {
    const r = examine(
      evidence([candidate("a", 1), candidate("b", 2)], { printIds: ["a"] }),
    );
    expect(r.findings.some((f) => f.check === "print.differs")).toBe(true);
    expect(score(r, scenario(), new Map()).trust).toBe(75);
  });

  it("catches a value that rendered as nothing", () => {
    const r = examine(
      evidence([candidate("a", 1)], { printText: "About NaN minutes here" }),
    );
    expect(r.findings.some((f) => f.check === "print.broken-text")).toBe(true);
  });

  it("only fails 'somewhere dry' on what Atlas reads, labelled with how", () => {
    const wet = candidate("wet", 1, {
      environment: {
        setting: "outdoor",
        rain: { reading: "unknown", basis: "none" },
        exposure: {
          value: "outdoor",
          basis: "derived",
          evidence: "subtype: park",
        },
      } as DiscoveryCandidate["environment"],
    });
    const r = examine({
      ...evidence([wet]),
      scenario: scenario({ hears: {}, needs: { sheltered: true } }),
    });
    const f = r.findings.find((x) => x.check === "need.sheltered");
    expect(f?.basis).toBe("derived");
  });
});

describe("score", () => {
  it("stays within 0–100 and is zero for an empty day", () => {
    const empty = examine(evidence([]));
    const s = score(empty, scenario(), new Map());
    expect(s.overall).toBeLessThanOrEqual(100);
    expect(s.factual).toBe(0);
  });
});

describe("compare", () => {
  const base = (over: Partial<Run> = {}): Run => {
    const r = examine(evidence([candidate("a", 1), candidate("b", 2)]));
    const scores = score(r, scenario(), new Map());
    return {
      schema: "ghad-critic/1",
      runId: "r1",
      startedAt: "",
      today: "2026-10-11",
      source: { kind: "fixture", where: "", sha256: "d1", candidates: 2 },
      code: { commit: "c", branch: "b", dirty: false, fingerprint: "f1" },
      cohortFingerprint: "k1",
      pageAsked: { on: false, childAge: false },
      scenarios: [{ ...r, scores }],
      totals: { ...scores, objectiveFindings: 1, distinctStops: {} },
      ...over,
    };
  };

  it("names the cause and lists what resolved", () => {
    const before = base();
    const fixed = {
      ...before.scenarios[0]!,
      findings: [],
    };
    const now = base({
      runId: "r2",
      code: { ...before.code, fingerprint: "f2" },
      scenarios: [fixed],
    });
    const d = compare(now, before);
    expect(d.causes).toEqual(["code"]);
    expect(d.resolvedFindings.map((f) => f.check)).toEqual(["reading.hours"]);
    expect(d.regressed).toBe(false);
  });

  it("regresses on a new objective finding", () => {
    const before = base();
    const worse = {
      ...before.scenarios[0]!,
      findings: [
        ...before.scenarios[0]!.findings,
        {
          key: "s:print.differs",
          scenario: "s",
          check: "print.differs",
          dimension: "trust" as const,
          basis: "page" as const,
          detail: "d",
        },
      ],
    };
    const d = compare(base({ runId: "r2", scenarios: [worse] }), before);
    expect(d.regressed).toBe(true);
    expect(d.causes).toEqual([]);
  });
});
