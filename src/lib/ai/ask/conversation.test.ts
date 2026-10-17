import { describe, expect, it } from "vitest";
import { foldAsk, questionFor, readConversation } from "./conversation";
import { readAsk, readBack } from "./read";

// A Friday.
const today = "2026-10-16";
const talk = (...said: string[]) => readConversation(said, { today });
const read = (said: string) => readAsk(said, { today });

/**
 * **The mission's own conversation, turn by turn.** Each answer is read as
 * the answer to the question that was on screen, and nothing said earlier is
 * forgotten.
 */
describe("a conversation that remembers", () => {
  it("asks how much time, then how far, then stops asking", () => {
    const first = talk("Something fun with my daughter.");
    expect(first.ask).toMatchObject({ company: "child", lens: "kids" });
    expect(first.question?.about).toBe("time");

    const second = talk(
      "Something fun with my daughter.",
      "About three hours.",
    );
    expect(second.ask).toMatchObject({ company: "child", hours: 3 });
    expect(second.question?.about).toBe("distance");

    const third = talk(
      "Something fun with my daughter.",
      "About three hours.",
      "Maybe 45 minutes.",
    );
    expect(third.ask).toMatchObject({
      company: "child",
      lens: "kids",
      hours: 3,
      driveMinutes: 45,
    });
    // Two questions is the most a conversation is asked.
    expect(third.question).toBeUndefined();
  });

  it("'maybe 45 minutes' is a drive after 'how far?', and a length after 'how long?'", () => {
    const far = talk("Three hours with my kid", "Maybe 45 minutes");
    expect(far.ask.driveMinutes).toBe(45);
    expect(far.ask.hours).toBe(3);
    const long = talk("Something with my kid", "Maybe 45 minutes");
    expect(long.ask.hours).toBe(0.75);
    expect(long.ask.driveMinutes).toBeUndefined();
  });

  it("'Actually, somewhere indoors' changes the sky and nothing else", () => {
    const before = talk(
      "Something fun with my daughter.",
      "About three hours.",
      "Maybe 45 minutes.",
    ).ask;
    const after = talk(
      "Something fun with my daughter.",
      "About three hours.",
      "Maybe 45 minutes.",
      "Actually, somewhere indoors.",
    ).ask;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { said, ...kept } = before;
    expect(after).toMatchObject({ ...kept, shelter: "indoor" });
    expect(readBack(after, { today })).toEqual(
      expect.arrayContaining([
        "3 hours",
        "with a kid",
        "up to 45 min away",
        "staying dry",
      ]),
    );
  });

  it("'Actually, make that tomorrow' moves the day and keeps the evening", () => {
    const ask = talk(
      "Something unusual tonight",
      "Actually, make that tomorrow",
    ).ask;
    expect(ask).toMatchObject({
      lens: "unusual",
      on: "2026-10-17",
      partOfDay: "evening",
    });
    expect(readBack(ask, { today })).toContain("tomorrow evening");
  });

  it("a later distance replaces an earlier one", () => {
    const ask = talk("within 20 minutes", "actually, walking distance").ask;
    expect(ask.withinKm).toBe(2);
    expect(ask.driveMinutes).toBeUndefined();
  });

  it("friends after a child drops the age; a child after a date drops the two of you", () => {
    expect(
      talk("with my 5 year old", "actually, with friends").ask,
    ).toMatchObject({ company: "group" });
    expect(
      talk("with my 5 year old", "actually, with friends").ask.childAge,
    ).toBeUndefined();
    const kid = talk("date night", "we're bringing my son").ask;
    expect(kid.pair).toBeUndefined();
    expect(kid.company).toBe("child");
  });

  it("'show me something completely different' keeps who and when, drops the activity", () => {
    const ask = talk(
      "Hiking with my 6 year old tomorrow",
      "Show me something completely different",
    ).ask;
    expect(ask).toMatchObject({
      childAge: 6,
      on: "2026-10-17",
      different: true,
    });
    expect(ask.doing).toBeUndefined();
  });

  it("'start over' starts over", () => {
    const ask = talk(
      "with my 5 year old indoors",
      "start over — a date night",
    ).ask;
    expect(ask.childAge).toBeUndefined();
    expect(ask.shelter).toBeUndefined();
    expect(ask.pair).toBe(true);
  });

  it("no to an activity un-chooses it, and naming it again un-refuses it", () => {
    expect(talk("hiking", "actually, no hiking").ask.doing).toBeUndefined();
    const back = talk("outside but not hiking", "ok, hiking is fine").ask;
    expect(back.doing).toBe("hiking");
    expect(back.avoid).toBeUndefined();
  });

  it("'5' answers 'how old?'", () => {
    const ask = talk(
      "something with my kid",
      "a couple of hours",
      "within 20 minutes",
    ).ask;
    expect(ask.driveMinutes).toBe(20);
    expect(questionFor(ask, new Set(["time"]))?.about).toBe("age");
    expect(readAsk("5", { today, expecting: "age" }).childAge).toBe(5);
  });

  it("does not ask what was already said, or anything of an unread sentence", () => {
    expect(
      talk("three hours with my 6 year old within 20 minutes").question,
    ).toBeUndefined();
    expect(talk("blorp").question).toBeUndefined();
    expect(talk("What's on tonight?").question).toBeUndefined();
  });

  it("folds nothing over nothing", () => {
    expect(foldAsk(undefined, read("indoors"))).toMatchObject({
      shelter: "indoor",
    });
  });
});

/** The twelve sentences the mission names, read as what they say. */
describe("the mission's twelve sentences", () => {
  it("1. I'm bored — a surprise, not 'I didn't catch that'", () => {
    expect(read("I'm bored.").lens).toBe("surprise");
  });

  it("2. something fun with my five-year-old", () => {
    expect(read("Something fun with my five-year-old.")).toMatchObject({
      company: "child",
      childAge: 5,
      lens: "kids",
    });
  });

  it("3. three hours and don't want to drive far", () => {
    expect(
      read("We have three hours and don't want to drive far."),
    ).toMatchObject({ hours: 3, near: true });
  });

  it("4. something unusual tonight", () => {
    expect(read("Something unusual tonight.")).toMatchObject({
      lens: "unusual",
      on: today,
      partOfDay: "evening",
    });
  });

  it("5. raining, indoors", () => {
    expect(read("It's raining. What can we do indoors?").shelter).toBe(
      "indoor",
    );
  });

  it("6. a romantic afternoon", () => {
    expect(read("A romantic afternoon.")).toMatchObject({
      pair: true,
      lens: "couple",
      partOfDay: "afternoon",
    });
  });

  it("7. outside but not hiking", () => {
    const ask = read("I want to get outside but not hike.");
    expect(ask).toMatchObject({ shelter: "outdoor", avoid: ["hiking"] });
    expect(ask.doing).toBeUndefined();
  });

  it("8. something adventurous near Vancouver", () => {
    expect(read("Something adventurous near Vancouver.")).toMatchObject({
      lens: "adventure",
      townId: "vancouver",
    });
  });

  it("9. actually, make that tomorrow", () => {
    expect(read("Actually, make that tomorrow.").on).toBe("2026-10-17");
  });

  it("10. something completely different", () => {
    expect(read("Show me something completely different.").different).toBe(
      true,
    );
  });

  it("11. free within 30 minutes", () => {
    expect(read("Something free within 30 minutes.")).toMatchObject({
      free: true,
      driveMinutes: 30,
    });
  });

  it("12. something I've never tried", () => {
    expect(read("I want to do something I've never tried.").lens).toBe(
      "unusual",
    );
  });
});

describe("people, time and distance, said loosely", () => {
  it("reads company however it is put", () => {
    expect(read("Me and my five-year-old")).toMatchObject({
      company: "child",
      childAge: 5,
    });
    expect(read("Two adults and three kids").company).toBe("child");
    expect(read("Just me").company).toBe("alone");
    expect(read("A date with my partner").pair).toBe(true);
    expect(read("Something for grandparents").gentle).toBe(true);
    expect(read("I want to surprise my wife").lens).toBe("couple");
  });

  it("reads time however it is put", () => {
    expect(read("About 90 minutes").hours).toBe(1.5);
    expect(read("Three hours including driving").hours).toBe(3);
    expect(read("All afternoon")).toMatchObject({
      hours: 4,
      partOfDay: "afternoon",
    });
    expect(read("After dinner").partOfDay).toBe("evening");
    expect(read("Tomorrow evening")).toMatchObject({
      on: "2026-10-17",
      partOfDay: "evening",
    });
  });

  it("reads distance however it is put", () => {
    expect(read("Walking distance").withinKm).toBe(2);
    expect(read("Within 20 minutes").driveMinutes).toBe(20);
    expect(read("Happy to drive an hour")).toMatchObject({ driveMinutes: 60 });
    expect(read("Happy to drive an hour").lens).toBeUndefined();
    expect(read("Anywhere around Vancouver").townId).toBe("vancouver");
    // Still a lens where it asks for somewhere further.
    expect(read("What is worth driving an hour for?").lens).toBe("drive");
  });
});
