import { describe, expect, it } from "vitest";
import { planHref, readSentence } from "./sentence";

const TODAY = "2026-11-01"; // a Sunday

describe("readSentence", () => {
  it("reads the brief's own sentence", () => {
    const r = readSentence(
      "We have Saturday afternoon, two kids, and $100.",
      TODAY,
    );
    expect(r).toMatchObject({
      shape: "family-day",
      from: "2026-11-07",
      party: "family",
    });
    expect(r.say).toContain("$100");
  });

  it("makes a romantic evening a couple's evening", () => {
    const r = readSentence("Make us a romantic Christmas evening", TODAY);
    expect(r).toMatchObject({ shape: "evening", party: "couple" });
    expect(r.from).toBeUndefined();
  });

  it("reads tonight, tomorrow and a named date", () => {
    expect(readSentence("tonight with friends", TODAY).from).toBe(TODAY);
    expect(readSentence("tomorrow", TODAY).from).toBe("2026-11-02");
    expect(readSentence("Dec 12 market day", TODAY)).toMatchObject({
      from: "2026-12-12",
      shape: "market",
    });
    expect(readSentence("Feb 30", TODAY).from).toBeUndefined();
  });

  it("reads ages and a town, longest name first", () => {
    const r = readSentence(
      "a 5 year old and kids aged 3 and 8 in North Vancouver",
      TODAY,
    );
    expect(r.ages).toEqual([5, 3, 8]);
    expect(r.at).toBe("north-vancouver");
  });

  it("invents nothing from a sentence it cannot read", () => {
    const r = readSentence("something nice", TODAY);
    expect(r.from).toBeUndefined();
    expect(r.party).toBeUndefined();
    expect(r.at).toBeUndefined();
    expect(r.ages).toEqual([]);
  });

  it("writes a planner address that keeps the words", () => {
    const href = planHref(readSentence("Saturday, 2 kids, $100", TODAY));
    expect(href).toContain("/christmas/plan?shape=family-day");
    expect(href).toContain("from=2026-11-07");
    expect(decodeURIComponent(href)).toContain("$100");
  });
});
