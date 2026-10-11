import { describe, expect, it } from "vitest";
import { readBrief, replacedStop, reviseBrief } from "./brief";

/**
 * **"Five hours, $100, with a five-year-old, near Vernon."**
 *
 * The acceptance sentence, and the four things it has to get right without a
 * model, a key or a network — because there is no OpenAI key configured in
 * this repository and a feature that only works with one is a feature that
 * does not work.
 */
describe("reading what somebody said", () => {
  const brief = readBrief(
    "Five hours, $100, with a five-year-old, near Vernon.",
  );

  it("reads the hours, in words or digits", () => {
    expect(brief.hours).toBe(5);
    expect(readBrief("I have 3 hours").hours).toBe(3);
    expect(readBrief("half a day").hours).toBe(4);
    expect(readBrief("an hour or so").hours).toBe(1);
  });

  it("reads the money", () => {
    expect(brief.budget).toBe(100);
    expect(readBrief("under $60 for the two of us").budget).toBe(60);
    expect(readBrief("something free").budget).toBe(0);
  });

  it("reads an age only where a number was given", () => {
    expect(brief.childAge).toBe(5);
    // **"With my kid" is not an age.** Guessing five is the invention every
    // other surface in this product refuses to make.
    expect(readBrief("a day out with my kid").childAge).toBeUndefined();
    expect(readBrief("with the family").childAge).toBeUndefined();
  });

  it("reads the town, from the list Passport actually holds", () => {
    expect(brief.town?.id).toBe("vernon");
    expect(readBrief("a rainy day in Burnaby").town?.id).toBe("burnaby");
    expect(readBrief("somewhere in Narnia").town).toBeUndefined();
  });

  it("reads interests as the person's own words", () => {
    expect(
      readBrief("somewhere with animals and a playground").interests,
    ).toEqual(expect.arrayContaining(["animals", "playground"]));
  });

  it("reads shelter and appetite", () => {
    expect(readBrief("a rainy-day family escape").shelter).toBe("indoor");
    expect(readBrief("a spontaneous outdoor adventure").shelter).toBe(
      "outdoor",
    );
    expect(readBrief("a spontaneous outdoor adventure").appetite).toBe(
      "adventurous",
    );
    expect(readBrief("something unusual within 30 km").appetite).toBe("odd");
    expect(readBrief("something unusual within 30 km").withinKm).toBe(30);
  });

  it("keeps what Discovery already knew, and lets a sentence overrule it", () => {
    const carried = readBrief("make it four hours", {
      childAge: 5,
      hours: 8,
      on: "2026-10-12",
    });
    expect(carried.hours).toBe(4);
    expect(carried.childAge).toBe(5);
    expect(carried.on).toBe("2026-10-12");
  });
});

/**
 * **A revision changes one thing and leaves the rest alone.**
 *
 * The doctrine calls this out by name (§2.5): *"my friend is allergic to
 * shellfish and we have to be home by 9 — just adjust those two things."*
 * Re-parsing the whole sentence would quietly discard everything else.
 */
describe("revising a day", () => {
  const base = readBrief(
    "Five hours, $100, with a five-year-old, near Vernon.",
  );

  it("halves the budget and keeps everything else", () => {
    const next = reviseBrief(base, "make it cheaper");
    expect(next.budget).toBe(50);
    expect(next.hours).toBe(5);
    expect(next.childAge).toBe(5);
    expect(next.town?.id).toBe("vernon");
  });

  it("turns it outdoors without forgetting the child", () => {
    const next = reviseBrief(base, "more outdoors");
    expect(next.shelter).toBe("outdoor");
    expect(next.childAge).toBe(5);
  });

  it("tightens the circle for less driving", () => {
    const next = reviseBrief({ ...base, withinKm: 30 }, "less driving");
    expect(next.withinKm).toBe(15);
    expect(next.lessDriving).toBe(true);
  });

  it("widens it when asked to go further", () => {
    expect(reviseBrief({ ...base, withinKm: 30 }, "go further").withinKm).toBe(
      60,
    );
  });

  it("makes it weirder, and more adventurous, as different things", () => {
    expect(reviseBrief(base, "make it weirder").appetite).toBe("odd");
    expect(reviseBrief(base, "make it more adventurous").appetite).toBe(
      "adventurous",
    );
  });

  it("keeps a record of what was asked, so the guide can say", () => {
    expect(reviseBrief(base, "make it cheaper").said).toContain(
      "make it cheaper",
    );
    expect(reviseBrief(base, "make it cheaper").said).toContain("Five hours");
  });
});

describe("replacing one stop", () => {
  it("reads which one", () => {
    expect(replacedStop("replace the second stop")).toBe(2);
    expect(replacedStop("swap the 3rd one for something else")).toBe(3);
  });

  it("says nothing where no stop was named", () => {
    expect(replacedStop("make it cheaper")).toBeUndefined();
    expect(replacedStop("the second one was great")).toBeUndefined();
  });
});
