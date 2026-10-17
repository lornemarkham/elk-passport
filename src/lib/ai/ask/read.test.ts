import { describe, expect, it } from "vitest";
import { readAsk, readBack } from "./read";

// A Sunday.
const today = "2026-10-11";
const verbs = ["Hiking", "Swimming", "Playground", "Picnic areas", "Fishing"];
const read = (said: string) => readAsk(said, { today, verbs });

/**
 * **The four questions the mission names, read into the rows Discovery has.**
 *
 * Each one is pinned to exactly what it says and nothing it does not: no
 * age from "kid", no position from "nearby", no hours from "an hour's drive".
 */
describe("the four questions", () => {
  it("'What can we do with three hours?' is a length of time", () => {
    const ask = read("What can we do with three hours?");
    expect(ask).toMatchObject({ hours: 3, window: "half-day", lens: "time" });
    expect(ask.company).toBeUndefined();
    expect(ask.on).toBeUndefined();
  });

  it("'What's something unusual nearby?' is a lens and a wish to stay close", () => {
    const ask = read("What's something unusual nearby?");
    expect(ask).toMatchObject({ lens: "unusual", near: true });
    // "nearby" is not a number anybody said.
    expect(ask.withinKm).toBeUndefined();
  });

  it("'Where can I take my kid this afternoon?' is a child, today, half a day — and no age", () => {
    const ask = read("Where can I take my kid this afternoon?");
    expect(ask).toMatchObject({
      company: "child",
      on: today,
      partOfDay: "afternoon",
      window: "half-day",
      lens: "kids",
    });
    expect(ask.childAge).toBeUndefined();
  });

  it("'What is worth driving an hour for?' is about distance, not the length of the day", () => {
    const ask = read("What is worth driving an hour for?");
    expect(ask.lens).toBe("drive");
    expect(ask.hours).toBeUndefined();
    expect(ask.window).toBeUndefined();
  });
});

describe("what else it reads", () => {
  it("takes a stated age, and a town", () => {
    const ask = read("four hours with my 6 year old near Vernon");
    expect(ask).toMatchObject({
      hours: 4,
      childAge: 6,
      company: "child",
      townId: "vernon",
    });
  });

  it("resolves tomorrow and weekdays from today, never from a clock", () => {
    expect(read("something to do tomorrow").on).toBe("2026-10-12");
    expect(read("what about Saturday").on).toBe("2026-10-17");
    // Sunday asked on a Sunday is today.
    expect(read("Sunday with friends").on).toBe(today);
    expect(read("Sunday with friends").company).toBe("group");
  });

  it("names an activity in the person's words, not Atlas's", () => {
    expect(read("a hike with the kids").doing).toBe("hiking");
    expect(read("swimming somewhere warm").doing).toBe("swimming");
    expect(read("go bowling").doing).toBe("games");
    expect(read("the movies tonight").doing).toBe("movies");
    expect(read("ice skating").doing).toBe("skating");
    // Common words never choose an activity by accident.
    expect(read("something good near here this weekend").doing).toBeUndefined();
  });

  it("keeps a stated distance as a radius", () => {
    expect(read("something within 20 km").withinKm).toBe(20);
  });

  it("does not read 'family' as a child", () => {
    expect(read("a family dinner").company).toBeUndefined();
  });

  it("hears an unusual question even with a kid in it", () => {
    expect(read("something weird to do with my niece").lens).toBe("unusual");
  });

  it("removes only the drive, so the rest of the sentence is still read", () => {
    const ask = read("something worth the drive with my 5 year old");
    expect(ask).toMatchObject({ lens: "drive", childAge: 5, company: "child" });
    const away = read("what's an hour's drive away?");
    expect(away.lens).toBe("drive");
    expect(away.hours).toBeUndefined();
    expect(read("a day trip on Saturday").on).toBe("2026-10-17");
  });

  it("reads 'worth the drive' with hours as both", () => {
    const ask = read("five hours, worth the drive");
    expect(ask).toMatchObject({ lens: "drive", hours: 5 });
  });

  it("leaves a sentence it cannot read as nothing but the sentence", () => {
    expect(read("hmm")).toEqual({ said: "hmm" });
  });
});

describe("what it says back", () => {
  it("names each part in a person's words", () => {
    expect(
      readBack(read("Where can I take my kid this afternoon?"), { today }),
    ).toEqual(["with a kid", "this afternoon"]);
    expect(
      readBack(read("something unusual nearby"), {
        today,
        townName: "Vernon",
      }),
    ).toEqual(["something unusual", "close by", "from Vernon"]);
  });
});

/**
 * **Who it is with, what is on, and the sky — measured against real
 * questions run on 2026-10-11** (`corpus.eval.test.ts`).
 */
describe("who, what's on, and the weather", () => {
  const atlas = (said: string) =>
    readAsk(said, {
      today,
      verbs: ["night skiing", "Family Fun Hours", "Hiking"],
    });

  it("'Date night tonight' is the two of them this evening — not night skiing", () => {
    const ask = atlas("Date night tonight");
    expect(ask).toMatchObject({
      pair: true,
      lens: "couple",
      on: today,
      partOfDay: "evening",
    });
    expect(ask.doing).toBeUndefined();
    // The rows have no couple: who's coming is left as it was.
    expect(ask.company).toBeUndefined();
    expect(readBack(ask, { today })).toEqual(["the two of you", "tonight"]);
  });

  it("'a couple of hours' is a length, not a couple", () => {
    const ask = read("We have a couple of hours");
    expect(ask.pair).toBeUndefined();
    expect(ask.lens).not.toBe("couple");
  });

  it("a partner beside a child is a family, not a date", () => {
    const ask = read("me, my wife and our 5 year old");
    expect(ask).toMatchObject({ company: "child", lens: "kids" });
    expect(ask.pair).toBeUndefined();
  });

  it("'I've got an hour' chooses no verb with 'hour' in it", () => {
    expect(atlas("I've got an hour").doing).toBeUndefined();
    expect(atlas("What is worth driving an hour for?").doing).toBeUndefined();
  });

  it("'What's on today?' asks what is on, today", () => {
    const ask = read("What's on today?");
    expect(ask).toMatchObject({ lens: "on", on: today });
    expect(readBack(ask, { today })).toEqual(["what's on", "today"]);
  });

  it("'What's happening?' with no day is about today", () => {
    expect(read("What's happening?")).toMatchObject({ lens: "on", on: today });
  });

  it("friends are a group, and a group is a lens", () => {
    expect(read("Friends are in town, what should we do?")).toMatchObject({
      company: "group",
      lens: "group",
    });
  });

  it("on your own is said, and changes no lens", () => {
    const ask = read("Something to do on my own today");
    expect(ask).toMatchObject({ company: "alone", on: today });
    expect(ask.lens).toBeUndefined();
  });

  it("a sunny day is a wish to be outside it, as rain is to stay dry", () => {
    expect(read("It's sunny, what should we do?").shelter).toBe("outdoor");
    expect(read("It's raining, what can we do inside?").shelter).toBe("indoor");
  });
});

/**
 * **Sentences the reader once misread**, found by running ordinary phrasings
 * through it. Each pins what the words say and nothing they do not.
 */
describe("ordinary phrasings that were misread", () => {
  const withBikes = (said: string) =>
    readAsk(said, { today, verbs: [...verbs, "Cycling", "Kayaking"] });

  it("'a couple hours' is a length of time, not a date", () => {
    const ask = read("I have a couple hours after work");
    expect(ask).toMatchObject({ hours: 2, lens: "time" });
    expect(ask.pair).toBeUndefined();
    expect(read("a couple of hours").pair).toBeUndefined();
    expect(read("a couple of days").pair).toBeUndefined();
  });

  it("'a couple' on its own is still two people", () => {
    expect(read("something for a couple").pair).toBe(true);
  });

  it("'toddlers' is a child, not a wish for something odd", () => {
    const ask = read("rainy day with toddlers");
    expect(ask).toMatchObject({ company: "child", shelter: "indoor" });
    expect(ask.lens).toBe("kids");
  });

  it("'next weekend' is the weekend after this one", () => {
    // Today is Sunday 2026-10-11; this weekend's Saturday is the 17th.
    expect(read("this weekend").on).toBe("2026-10-17");
    expect(read("next weekend").on).toBe("2026-10-24");
  });

  it("names a day by how far off it is", () => {
    expect(read("what's on the day after tomorrow").on).toBe("2026-10-13");
    expect(read("something fun in two days").on).toBe("2026-10-13");
    expect(read("something fun in 3 days").on).toBe("2026-10-14");
    // Further out than a week is a date; it is not guessed.
    expect(read("something in 30 days").on).toBeUndefined();
  });

  it("'bike', 'mountain biking' and 'paddle' are the activities they name", () => {
    expect(withBikes("mountain biking").doing).toBe("mountain-biking");
    expect(withBikes("bike rides near Vernon").doing).toBe("cycling");
    expect(withBikes("somewhere to paddle").doing).toBe("paddling");
    expect(read("a canoe on the lake").doing).toBe("paddling");
  });

  it("a sentence that names no activity chooses none", () => {
    expect(
      read("something to burn off the kids' energy before dinner").doing,
    ).toBeUndefined();
  });
});
