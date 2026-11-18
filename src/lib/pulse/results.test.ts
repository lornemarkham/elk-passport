import { describe, expect, it } from "vitest";
import type { Pulse } from "./model";
import {
  breakdown,
  circleCodes,
  computeResults,
  wholePercents,
  type VoteRow,
} from "./results";

const pulse: Pulse = {
  id: "abcd2345",
  question: "Should Vernon build a second sheet of ice?",
  description: null,
  options: [
    { id: "o1", label: "Yes" },
    { id: "o2", label: "No" },
  ],
  claim: {
    text: "An article reports that 65% support it.",
    percent: 65,
    optionId: "o1",
    source: "Vernon Morning Star",
    url: "https://example.ca/a",
  },
  sourceUrl: null,
  scope: { kind: "city", province: "BC", city: "Vernon" },
  expiresAt: null,
  status: "live",
  createdAt: "2026-11-18T12:00:00.000Z",
};

let seq = 0;
const v = (option: string, extra: Partial<VoteRow> = {}): VoteRow => {
  seq += 1;
  return {
    option,
    province: null,
    city: null,
    at: new Date(
      Date.parse("2026-11-18T12:00:00Z") + seq * 60_000,
    ).toISOString(),
    circle: `c${String(seq).padStart(7, "0")}`.slice(0, 8),
    via: null,
    ...extra,
  };
};
const NOW = new Date("2026-11-18T20:00:00Z");

describe("results", () => {
  it("rounds to whole percentages that add up to 100", () => {
    expect(wholePercents([1, 1, 1])).toEqual([34, 33, 33]);
    expect(wholePercents([2, 1])).toEqual([67, 33]);
    expect(wholePercents([0, 0])).toEqual([0, 0]);
  });

  it("counts everyone exactly and compares with the published claim", () => {
    const votes = [
      v("o1"),
      v("o1"),
      v("o2"),
      v("o2"),
      v("o2"),
      v("o1"),
      v("o2"),
      v("o2"),
    ];
    const r = computeResults(pulse, votes, null, NOW);
    expect(r.total).toBe(8);
    // 37.5 / 62.5: the tied remainder goes to the first answer.
    expect(r.everyone.map((s) => [s.label, s.n, s.pct])).toEqual([
      ["Yes", 3, 38],
      ["No", 5, 62],
    ]);
    expect(r.claim).toMatchObject({
      claimed: 65,
      pulse: 38,
      label: "Yes",
      source: "Vernon Morning Star",
    });
  });

  it("withholds the claim comparison until five votes", () => {
    const r = computeResults(pulse, [v("o1"), v("o2")], null, NOW);
    expect(r.claim?.pulse).toBeNull();
  });

  it("hides a group under five and then releases it in steps of five", () => {
    const four = [v("o1"), v("o1"), v("o2"), v("o2")];
    expect(breakdown(pulse.options, four).shares).toBeNull();
    const seven = [...four, v("o1"), v("o2"), v("o2")];
    const b = breakdown(pulse.options, seven);
    expect(b.total).toBe(7);
    expect(b.counted).toBe(5);
    // Only the first five count: Yes 3, No 2.
    expect(b.shares?.map((s) => s.n)).toEqual([3, 2]);
  });

  it("a single new vote in a released group changes nothing visible", () => {
    const five = [v("o1"), v("o2"), v("o1"), v("o2"), v("o1")];
    const before = breakdown(pulse.options, five).shares;
    const after = breakdown(pulse.options, [...five, v("o2")]).shares;
    expect(after).toEqual(before);
  });

  it("follows referral links through friends of friends, and survives a loop", () => {
    const me = "meeeeeee";
    const votes = [
      v("o1", { circle: "aaaaaaaa", via: me }),
      v("o2", { circle: "bbbbbbbb", via: "aaaaaaaa" }),
      v("o2", { circle: "cccccccc", via: "bbbbbbbb" }),
      v("o1", { circle: "dddddddd", via: null }),
      v("o1", { circle: me, via: "cccccccc" }), // a loop back to me
    ];
    expect([...circleCodes(votes, me)].sort()).toEqual(
      ["aaaaaaaa", "bbbbbbbb", "cccccccc", me].sort(),
    );
    const r = computeResults(pulse, votes, me, NOW);
    expect(r.circle).toMatchObject({ total: 4, joinedViaYou: 1, shares: null });
  });

  it("compares a circle with everyone once it is big enough", () => {
    const me = "meeeeeee";
    const friends = [
      "f2222222",
      "f3333333",
      "f4444444",
      "f5555555",
      "f6666666",
    ].map((c, i) => v(i < 4 ? "o2" : "o1", { circle: c, via: me }));
    const strangers = Array.from({ length: 10 }, () => v("o1"));
    const r = computeResults(pulse, [...strangers, ...friends], me, NOW);
    expect(r.everyone.find((s) => s.optionId === "o1")?.pct).toBe(73);
    expect(r.circle?.shares?.map((s) => s.pct)).toEqual([20, 80]);
    expect(r.circle?.joinedViaYou).toBe(5);
  });

  it("names provinces and cities only at five votes and pools the rest", () => {
    const votes = [
      ...Array.from({ length: 6 }, (_, i) =>
        v(i % 2 ? "o1" : "o2", {
          province: "BC",
          city: i < 5 ? "Vernon" : "Kelowna",
        }),
      ),
      ...Array.from({ length: 2 }, () => v("o1", { province: "YT" })),
      v("o2"),
    ];
    const r = computeResults(pulse, votes, null, NOW);
    expect(r.provinces.map((p) => [p.key, p.total, p.counted])).toEqual([
      ["BC", 6, 5],
    ]);
    expect(r.cities.map((c) => c.name)).toEqual(["Vernon, BC"]);
    expect(r.otherPlaces).toBe(2);
    expect(r.unplaced).toBe(1);
  });

  it("charts cumulative participation hourly in the first three days", () => {
    const votes = [
      v("o1", { at: "2026-11-18T12:10:00Z" }),
      v("o2", { at: "2026-11-18T14:30:00Z" }),
      v("o1", { at: "2026-11-18T14:45:00Z" }),
    ];
    const r = computeResults(
      pulse,
      votes,
      null,
      new Date("2026-11-18T16:00:00Z"),
    );
    expect(r.timeline.bucket).toBe("hour");
    expect(r.timeline.points.map((p) => p.total)).toEqual([1, 1, 3, 3, 3]);
  });
});
