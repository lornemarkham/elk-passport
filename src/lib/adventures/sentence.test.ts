import { describe, expect, it } from "vitest";
import { daysNamed, readChange, startSentence } from "./sentence";
import { readBrief } from "@/domain/day/brief";
import { townById } from "@/domain/discovery/towns";

// Saturday 24 and Sunday 25 October 2026.
const WEEKEND = ["2026-10-24", "2026-10-25"];

describe("which days a sentence is about", () => {
  it("finds weekdays, day numbers, the last day and today", () => {
    expect(daysNamed("Make Saturday more adventurous", WEEKEND)).toEqual([
      "2026-10-24",
    ]);
    expect(daysNamed("sun: something easy", WEEKEND)).toEqual(["2026-10-25"]);
    expect(daysNamed("on day two, cheaper", WEEKEND)).toEqual(["2026-10-25"]);
    expect(daysNamed("the last day is too long", WEEKEND)).toEqual([
      "2026-10-25",
    ]);
    expect(daysNamed("today, out of the rain", WEEKEND, "2026-10-24")).toEqual([
      "2026-10-24",
    ]);
    expect(daysNamed("make it cheaper", WEEKEND)).toEqual([]);
  });
});

describe("reading a change to an adventure", () => {
  it("is about every day when no day is named", () => {
    expect(
      readChange("Keep everything within 30 minutes of Kelowna", WEEKEND),
    ).toEqual({
      kind: "revise",
      days: WEEKEND,
      said: "Keep everything within 30 minutes of Kelowna",
      fewer: false,
    });
  });

  it("lifts the day out of the sentence before the day reader sees it", () => {
    expect(readChange("Make Saturday more adventurous", WEEKEND)).toEqual({
      kind: "revise",
      days: ["2026-10-24"],
      said: "make it more adventurous",
      fewer: false,
    });
  });

  it("swaps two named days, or the only two", () => {
    expect(readChange("Swap Saturday and Sunday", WEEKEND)).toEqual({
      kind: "swap",
      days: ["2026-10-24", "2026-10-25"],
    });
    expect(readChange("switch the days around", WEEKEND)).toEqual({
      kind: "swap",
      days: WEEKEND,
    });
  });

  it("says a rainy-day alternative the way the reader knows it", () => {
    const change = readChange(
      "Give us a rainy-day alternative for Sunday",
      WEEKEND,
    );
    expect(change).toMatchObject({ kind: "revise", days: ["2026-10-25"] });
    expect(change.kind === "revise" && change.said).toContain(
      "out of the rain",
    );
  });

  it("makes a less demanding day easier and a stop shorter", () => {
    const change = readChange(
      "Saturday is too much, make it less demanding",
      WEEKEND,
    );
    expect(change).toMatchObject({
      kind: "revise",
      days: ["2026-10-24"],
      fewer: true,
    });
    expect(change.kind === "revise" && change.said).toContain("easier");
  });

  it("asks for words, and for dates, rather than guessing", () => {
    expect(readChange("  ", WEEKEND).kind).toBe("none");
    expect(readChange("make it cheaper", []).kind).toBe("none");
  });
});

describe("the guided start, as one sentence", () => {
  it("says what was chosen, and nothing that wasn't", () => {
    expect(startSentence({ vibes: [] })).toBe("a great day out");
    expect(
      startSentence({
        vibes: ["outdoors", "food"],
        party: "family",
        childAge: 5,
        extra: "home by 6",
      }),
    ).toBe(
      "get outside, good food and drink, with the kids, youngest is 5, home by 6",
    );
  });

  it("is read by the Day Builder the way it was meant", () => {
    const brief = readBrief(
      startSentence({
        vibes: ["adventurous"],
        party: "family",
        childAge: 5,
        extra: "within 30 minutes",
      }),
      { town: townById("kelowna") },
    );
    expect(brief.party).toBe("family");
    expect(brief.childAge).toBe(5);
    expect(brief.appetite).toBe("adventurous");
    expect(brief.withinMinutes).toBe(30);
  });
});

describe("a sentence that already says it", () => {
  it("is not given a second 'it'", () => {
    const change = readChange("Make it cheaper", WEEKEND);
    expect(change.kind === "revise" && change.said).toBe("Make it cheaper");
  });
});
