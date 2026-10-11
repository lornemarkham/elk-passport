import { describe, expect, it } from "vitest";
import {
  clockFrom,
  clockLabel,
  heardIn,
  readBrief,
  reviseBrief,
  stem,
} from "./brief";

/**
 * **Talking to the day.** Who is going, when they have to be home, what they
 * said no to — and the doctrine's own sentence: *"my friend is allergic to
 * shellfish and we have to be home by 9 PM. Just adjust those two things."*
 */
describe("who is going", () => {
  it("reads a party from words people actually use", () => {
    expect(readBrief("a date night in Kelowna").party).toBe("couple");
    expect(readBrief("me and my wife, four hours").party).toBe("couple");
    expect(readBrief("just me, a few hours").party).toBe("solo");
    expect(readBrief("a day out with the crew").party).toBe("friends");
    expect(readBrief("three hours with my niece").party).toBe("family");
  });

  it("calls it a family when there is a child, whoever else comes", () => {
    expect(readBrief("friends and their 6-year-old").party).toBe("family");
    expect(readBrief("four hours with a five-year-old").party).toBe("family");
  });

  it("assumes nobody when nobody was said", () => {
    expect(readBrief("four hours near Vernon").party).toBeUndefined();
  });

  it("still never invents an age for a family", () => {
    const brief = readBrief("the family, all day");
    expect(brief.party).toBe("family");
    expect(brief.childAge).toBeUndefined();
  });
});

describe("a window is hours too", () => {
  it("reads clock times the way people say them", () => {
    expect(clockFrom("9")).toBe(9 * 60);
    expect(clockFrom("9:30am")).toBe(9 * 60 + 30);
    expect(clockFrom("5")).toBe(17 * 60);
    expect(clockFrom("9 PM".toLowerCase())).toBe(21 * 60);
    expect(clockFrom("noon")).toBe(12 * 60);
    expect(clockLabel(17 * 60)).toBe("5 pm");
    expect(clockLabel(9 * 60 + 30)).toBe("9:30 am");
  });

  it("turns leave-at and home-by into hours", () => {
    const brief = readBrief("leave at 9, home by 3");
    expect(brief.startAt).toBe(9 * 60);
    expect(brief.homeBy).toBe(15 * 60);
    expect(brief.hours).toBe(6);
  });

  it("reads from-to", () => {
    const brief = readBrief("from 10 to 2 with the kids");
    expect(brief.startAt).toBe(10 * 60);
    expect(brief.homeBy).toBe(14 * 60);
    expect(brief.hours).toBe(4);
  });

  it("lets stated hours win over arithmetic", () => {
    expect(readBrief("two hours, home by 5").hours).toBe(2);
  });

  it("reads home-by alone as leaving now, only when it knows the clock, and says so", () => {
    expect(readBrief("home by 5").hours).toBeUndefined();
    const brief = readBrief("home by 5", {}, { nowMinutes: 13 * 60 + 5 });
    expect(brief.startsNow).toBe(true);
    expect(brief.startAt).toBe(13 * 60 + 15);
    expect(brief.hours).toBe(3.75);
  });

  it("no longer hears 'start' as an interest in art", () => {
    expect(readBrief("start at 10").interests).not.toContain("art");
    expect(readBrief("near the parking lot").interests).not.toContain("park");
  });
});

describe("what they said no to", () => {
  it("is kept in their words and compared by stem", () => {
    const brief = readBrief("four hours, no hiking, skip the museum");
    expect(brief.avoid).toEqual(["hiking", "museum"]);
    expect(brief.interests).not.toContain("hiking");
    expect(stem("hike")).toBe(stem("hiking"));
    expect(stem("swimming")).toBe(stem("swim"));
  });

  it("does not hear 'no driving' or 'not far' as places to avoid", () => {
    expect(readBrief("no driving, not far").avoid).toBeUndefined();
  });
});

describe("the doctrine's sentence", () => {
  const before = readBrief("four hours with friends near Vernon");
  const after = reviseBrief(
    before,
    "my friend is allergic to shellfish and we have to be home by 9 PM",
    { nowMinutes: 17 * 60 },
  );

  it("adjusts the time", () => {
    expect(after.homeBy).toBe(21 * 60);
    expect(after.startsNow).toBe(true);
    expect(after.hours).toBe(4);
  });

  it("keeps the allergy as something to ask, never as a filter", () => {
    expect(after.cautions?.[0]).toMatch(/shellfish allergy/);
    expect(after.cautions?.[0]).toMatch(/no menus/);
  });

  it("leaves everything else alone", () => {
    expect(after.party).toBe("friends");
    expect(after.town?.id).toBe("vernon");
    expect(after.interests).toEqual(before.interests);
  });

  it("says back what changed", () => {
    const heard = heardIn(before, after);
    expect(heard.join(" ")).toMatch(/Home by 9 pm/);
    expect(heard.join(" ")).toMatch(/shellfish/);
  });
});

describe("a deadline is a limit, not an extension", () => {
  const four = readBrief("four hours with friends near Vernon");

  it("keeps four hours when home-by leaves room for more", () => {
    const after = reviseBrief(four, "home by 9 pm", { nowMinutes: 10 * 60 });
    expect(after.hours).toBe(4);
    expect(after.homeBy).toBe(21 * 60);
  });

  it("shortens the day when home-by leaves less", () => {
    const after = reviseBrief(four, "home by 1", { nowMinutes: 11 * 60 });
    expect(after.hours).toBe(2);
  });

  it("takes a whole new window as the new hours", () => {
    expect(reviseBrief(four, "leave at 9, home by 4").hours).toBe(7);
  });
});

describe("revisions change one thing each", () => {
  const base = readBrief("four hours near Vernon, $40");

  it("reads a new party", () => {
    expect(reviseBrief(base, "actually it's just the two of us").party).toBe(
      "couple",
    );
  });

  it("reads shorter and longer", () => {
    expect(reviseBrief(base, "make it shorter").hours).toBe(3);
    expect(reviseBrief(base, "longer").hours).toBe(5);
  });

  it("reads a new budget without halving it", () => {
    expect(reviseBrief(base, "we have $80 now").budget).toBe(80);
    expect(reviseBrief(base, "keep it free").budget).toBe(0);
  });

  it("takes back a no when somebody asks for it again", () => {
    const no = reviseBrief(base, "no swimming");
    expect(no.avoid).toEqual(["swimming"]);
    const yes = reviseBrief(no, "add swimming");
    expect(yes.avoid).toEqual([]);
    expect(yes.interests).toContain("swimming");
  });

  it("hears nothing in a sentence with nothing in it", () => {
    expect(heardIn(base, reviseBrief(base, "hmm"))).toEqual([]);
  });
});
