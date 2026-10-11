import { describe, expect, it } from "vitest";
import { readBrief, reviseBrief } from "./brief";
import { ageIn, travelIn, hoursIn, offers, activitiesIn } from "./intent";
import { townById } from "@/domain/discovery/towns";

/** Defects an independent reviewer found in the first cut, each kept fixed. */
describe("review findings", () => {
  it("a negated activity is an avoid, in any plural", () => {
    for (const s of [
      "no wineries",
      "no wine",
      "skip the breweries",
      "no concerts",
      "don't want to hike",
      "not hiking",
      "anything but beaches",
    ]) {
      const b = readBrief(s, {});
      expect(b.avoid?.length, s).toBeGreaterThan(0);
      expect(b.interests, s).toEqual([]);
    }
  });

  it("stand up paddleboard is paddling, not comedy", () => {
    expect(readBrief("stand up paddleboard", {}).interests).toEqual([
      "paddling",
    ]);
    expect(activitiesIn("stand-up comedy night")).toContain("comedy");
  });

  it("does not invent an age from a number that is not one", () => {
    for (const s of [
      "she is 3 miles away",
      "he is 5 stops down",
      "they are 10 of us",
      "she's 2 hours into the drive",
    ])
      expect(ageIn(s), s).toBeUndefined();
    expect(ageIn("my 4 and 6 year olds")).toBe(4);
  });

  it("a name inside another word, or a negated town, does not move the day", () => {
    const base = readBrief("Half a day near Vernon", {});
    for (const s of [
      "my son Oliver is bored",
      "something golden",
      "not Kelowna",
      "it's raining in Kelowna",
      "the Kelowna one is closed",
    ])
      expect(reviseBrief(base, s).town?.id, s).toBe("vernon");
    expect(readBrief("a golden hour picnic", {}).town).toBeUndefined();
    expect(reviseBrief(base, "Kelowna").town?.id).toBe("kelowna");
    expect(reviseBrief(base, "actually, how about Penticton").town?.id).toBe(
      "penticton",
    );
  });

  it("travel phrasings that were read as a day's length", () => {
    expect(travelIn("an hour from kelowna").minutes).toBe(60);
    expect(travelIn("we are 2 hours from vernon").minutes).toBe(120);
    expect(travelIn("2 hours each way").minutes).toBe(120);
    expect(travelIn("drive max 2 hours").minutes).toBe(120);
    expect(travelIn("drive an hour and a half").minutes).toBe(90);
    expect(travelIn("travel two and a half hours").minutes).toBe(150);
    expect(travelIn("a 3 hour trip").minutes).toBeUndefined();
    expect(travelIn("back by 5pm within 30 minutes").minutes).toBe(30);
    expect(readBrief("an hour from Kelowna", {}).hours).toBeUndefined();
  });

  it("hours, said the ways people say them", () => {
    expect(hoursIn("i have two and a half hours")).toBe(2.5);
    expect(hoursIn("1 hour and a half")).toBe(1.5);
    expect(hoursIn("an hour and 15 minutes")).toBe(1.25);
    expect(hoursIn("twelve hours")).toBe(12);
    expect(hoursIn("check the opera hours")).toBeUndefined();
  });

  it("does not drop the child's age when it was only the last sentence's", () => {
    const b = readBrief("just me, a quiet walk", { childAge: 6 });
    expect(b.party).toBe("solo");
  });

  it("accented café is heard; parking is not a park", () => {
    expect(activitiesIn("a café")).toEqual(["cafe"]);
    expect(activitiesIn("fish and chips")).toEqual([]);
    expect(activitiesIn("Lake Country")).toEqual([]);
    expect(activitiesIn("movie theatre")).toEqual(["cinema"]);
    expect(offers).toBeTypeOf("function");
    expect(townById("kelowna")).toBeTruthy();
  });
});
