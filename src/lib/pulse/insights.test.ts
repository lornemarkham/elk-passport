import { describe, expect, it } from "vitest";
import { computeInsights, computeShifts, SHIFTS_FROM } from "./insights";
import type { VoteRow } from "./tally";

const options = [{ id: "o1" }, { id: "o2" }] as const;
let seq = 0;
const vote = (extra: Partial<VoteRow> = {}): VoteRow => {
  seq += 1;
  return {
    option: "o1",
    province: null,
    city: null,
    at: new Date(Date.UTC(2026, 10, 18, 12, 0, seq)).toISOString(),
    circle: `c${seq
      .toString(10)
      .split("")
      .map((d) => "abcdefghij"[Number(d)])
      .join("")
      .padStart(7, "a")}`,
    via: null,
    ...extra,
  };
};
const many = (n: number, extra: Partial<VoteRow> = {}) =>
  Array.from({ length: n }, () => vote(extra));

describe("the province map", () => {
  it("names a province only from five votes, and shows no count below", () => {
    const votes = [
      ...many(5, { province: "BC" }),
      ...many(4, { province: "ON", option: "o2" }),
    ];
    const { map } = computeInsights(
      { options: [...options].map((o) => ({ ...o, label: o.id })) },
      votes,
      null,
    );
    const bc = map.find((m) => m.code === "BC")!;
    const on = map.find((m) => m.code === "ON")!;
    expect(bc.state).toBe("shown");
    expect(bc.breakdown?.shares?.[0]?.pct).toBe(100);
    expect(on.state).toBe("hidden");
    expect(on.breakdown).toBeNull();
    expect(map).toHaveLength(13);
  });
});

describe("opinion shifts", () => {
  it("shows nothing until there are enough votes to say anything", () => {
    expect(computeShifts(options, many(SHIFTS_FROM - 1)).points).toEqual([]);
  });

  it("reports the share after the first n votes, ending on everyone", () => {
    const votes = [
      ...many(10, { option: "o1" }),
      ...many(10, { option: "o2" }),
    ];
    const { points } = computeShifts(options, votes);
    expect(points[0]).toEqual({ n: 10, pct: [100, 0] });
    expect(points.at(-1)).toEqual({ n: 20, pct: [50, 50] });
  });

  it("keeps the chart to a few dozen points however many vote", () => {
    const { points } = computeShifts(options, many(5000));
    expect(points.length).toBeLessThanOrEqual(40);
    expect(points.at(-1)?.n).toBe(5000);
  });
});

describe("how a Pulse spread", () => {
  const a = vote(); // arrived directly
  const b = vote({ via: a.circle });
  const c = vote({ via: b.circle });
  const d = vote({ via: "zzzzzzzz" }); // through someone who never voted

  it("counts people by how many links from the start they are", () => {
    const { spread } = computeInsights({ options: [] }, [a, b, c, d], null);
    expect(spread.generations).toEqual([
      { gen: 0, votes: 1 },
      { gen: 1, votes: 2 },
      { gen: 2, votes: 1 },
    ]);
    expect(spread.direct).toBe(1);
    expect(spread.referred).toBe(3);
  });

  it("survives a loop of links", () => {
    const x = vote({ circle: "xxxxxxxx", via: "yyyyyyyy" });
    const y = vote({ circle: "yyyyyyyy", via: "xxxxxxxx" });
    const { spread } = computeInsights({ options: [] }, [x, y], null);
    expect(spread.generations.reduce((n, g) => n + g.votes, 0)).toBe(2);
  });

  it("names a network only from five votes and never exposes a code", () => {
    const root = vote();
    const members = Array.from({ length: 5 }, () => vote({ via: root.circle }));
    const lone = many(3);
    const { spread } = computeInsights(
      { options: [{ id: "o1", label: "Yes" }] },
      [root, ...members, ...lone],
      root.circle,
    );
    expect(spread.networks).toHaveLength(1);
    expect(spread.networks[0]!.label).toBe("Network 1");
    expect(spread.networks[0]!.mine).toBe(true);
    expect(spread.networks[0]!.total).toBe(6);
    expect(spread.pooled).toBe(3);
    expect(JSON.stringify(spread)).not.toContain(root.circle);
  });

  it("counts your own reach level by level, without answers", () => {
    const { spread } = computeInsights({ options: [] }, [a, b, c, d], a.circle);
    expect(spread.mine).toEqual([
      { gen: 1, votes: 1 },
      { gen: 2, votes: 1 },
    ]);
  });
});
