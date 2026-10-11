import { describe, expect, it } from "vitest";
import type { DayPlanned } from "@/domain/day/build";
import {
  dayQuery,
  offlineHref,
  parseOfflineDay,
  planLine,
  snapshotDay,
} from "./day";

/**
 * **What stays on the phone is the printed day, reduced to a pocket.**
 *
 * Pinned: names, towns and minutes only — a town is Atlas's, never guessed;
 * an empty day is not kept; the hand-off reads exactly the query the paper
 * reads and nothing else; storage that is malformed is ignored.
 */
const stop = (
  id: string,
  title: string,
  minutes: number,
  locality?: string,
) => ({
  experience: {
    id,
    title,
    ...(locality ? { geography: { locality } } : {}),
  },
  minutes,
  because: "a long reason that belongs on the paper",
  notes: ["a rule that belongs on the paper"],
});

const day = (stops: ReturnType<typeof stop>[]) =>
  ({
    title: "t",
    opening: "o",
    closing: "c",
    unknowns: [],
    brief: { said: "four hours, outdoors" },
    stops,
  }) as unknown as DayPlanned;

describe("snapshotDay", () => {
  it("keeps names, Atlas's town where stated, and minutes — not the guide", () => {
    const kept = snapshotDay(
      day([
        stop("a", "Kalamalka Lake", 89.6, "Vernon"),
        stop("b", "Davison Orchards", 60),
      ]),
      "stops=a,b",
    )!;
    expect(kept).toEqual({
      said: "four hours, outdoors",
      stops: [
        { id: "a", name: "Kalamalka Lake", where: "Vernon", minutes: 90 },
        { id: "b", name: "Davison Orchards", minutes: 60 },
      ],
      print: "stops=a,b",
    });
    expect(JSON.stringify(kept)).not.toMatch(/reason|rule/);
    expect(parseOfflineDay(kept)).toEqual(kept);
  });

  it("keeps nothing for a day with no stops", () => {
    expect(snapshotDay(day([]), "")).toBeUndefined();
  });
});

describe("parseOfflineDay", () => {
  it("ignores what it cannot trust", () => {
    expect(parseOfflineDay(null)).toBeUndefined();
    expect(parseOfflineDay({ said: "", stops: [], print: "" })).toBeUndefined();
    expect(
      parseOfflineDay({ said: "", stops: [{ id: "a" }], print: "" }),
    ).toBeUndefined();
  });
});

describe("planLine", () => {
  it("is the plan, in order", () => {
    expect(
      planLine({
        said: "",
        print: "",
        stops: [
          { id: "a", name: "Lake", minutes: 1 },
          { id: "b", name: "Orchard", minutes: 1 },
        ],
      }),
    ).toBe("Lake → Orchard");
  });
});

describe("the hand-off from planning", () => {
  it("links /detox with the print query's day keys, and only those", () => {
    expect(
      offlineHref("stops=a%2Cb&say=four+hours&hours=4&at=vernon&utm=x"),
    ).toBe("/detox?stops=a%2Cb&say=four+hours&hours=4&at=vernon");
    expect(offlineHref("")).toBe("/detox");
  });

  it("reduces a Next query to the same keys", () => {
    expect(
      dayQuery({ stops: "a,b", age: "5", on: ["x", "y"], other: "z" }),
    ).toBe("stops=a%2Cb&age=5");
  });
});
