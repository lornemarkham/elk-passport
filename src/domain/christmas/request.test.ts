import { describe, expect, it } from "vitest";
import { PLAN_STARTS, QUICK_STARTS, readRequest, titleFor } from "./request";

const TODAY = "2026-11-14"; // a Saturday

const needs = (s: string) => readRequest(s, TODAY).needs.map((n) => n.need);

describe("readRequest — the parts somebody asked for", () => {
  it("reads every part of the brief's failing sentence", () => {
    const r = readRequest(
      "Romantic night of lights, dinner and a movie.",
      TODAY,
    );
    expect(r.needs).toEqual([
      { need: "lights", said: true },
      { need: "dinner", said: true },
      { need: "movie", said: true },
    ]);
    expect(r.romantic).toBe(true);
    expect(r.party).toBe("couple");
    expect(r.people).toBe(2);
    expect(r.time).toBe("evening");
    expect(r.day).toBeUndefined();
    expect(titleFor(r)).toBe("Our romantic Christmas evening");
  });

  it("does not read a movie theatre as a show, or a light-up as the lights", () => {
    expect(needs("dinner then the movie theatre")).toEqual(["dinner", "movie"]);
    expect(needs("the tree light-up and a parade")).toEqual(["festival"]);
    expect(needs("The Nutcracker and hot chocolate")).toEqual([
      "show",
      "coffee",
    ]);
  });

  it("reads who, how many, the budget, the day and the time", () => {
    const r = readRequest(
      "Family with two kids and $100, Saturday afternoon",
      TODAY,
    );
    expect(r.party).toBe("family");
    expect(r.kids).toBe(2);
    expect(r.budget).toBe(100);
    expect(r.day).toBe(TODAY);
    expect(r.time).toBe("afternoon");
    expect(r.needs.every((n) => !n.said)).toBe(true);
  });

  it("reads a start time, a home-by and walking", () => {
    const r = readRequest(
      "dinner at 6 and lights, home by 9, walking, in Kelowna on Dec 12",
      TODAY,
    );
    expect(r.start).toBe(18 * 60);
    expect(r.homeBy).toBe(21 * 60);
    expect(r.mode).toBe("walk");
    expect(r.at).toBe("kelowna");
    expect(r.day).toBe("2026-12-12");
  });

  it("asks nothing it was told: friends + markets + a date is complete", () => {
    const r = readRequest(
      "Friends visiting Christmas markets on Nov 28",
      TODAY,
    );
    expect(r.party).toBe("friends");
    expect(r.day).toBe("2026-11-28");
    expect(r.needs).toEqual([{ need: "market", said: true }]);
  });

  it("a lights tour is asked for as a tour", () => {
    expect(readRequest("Christmas lights driving tour", TODAY).tour).toBe(true);
    expect(readRequest("dinner and the lights", TODAY).tour).toBe(false);
  });

  it("with no parts named, suggests some — marked as Passport's, not said", () => {
    const r = readRequest("Make us a romantic Christmas evening", TODAY);
    expect(r.needs).toEqual([
      { need: "dinner", said: false },
      { need: "lights", said: false },
    ]);
  });
});

describe("the plan page's starts and the wider reader", () => {
  it("names four starts, each one of the quick-start sentences", () => {
    expect(PLAN_STARTS.map((s) => s.label)).toEqual([
      "Date Night",
      "Family Fun",
      "Christmas Lights",
      "Christmas Markets",
    ]);
    for (const s of PLAN_STARTS)
      expect(QUICK_STARTS.some((q) => q.say === s.say)).toBe(true);
  });

  it("reads an accessibility need, said back and never assumed", () => {
    expect(
      readRequest("Lights with grandma in a wheelchair", "2026-11-14").access,
    ).toBe("wheelchair");
    expect(
      readRequest("Markets with a stroller, no stairs", "2026-11-14").access,
    ).toBe("stroller");
    expect(
      readRequest("Lights and dinner", "2026-11-14").access,
    ).toBeUndefined();
  });

  it("reads a finish time in more ways than 'home by'", () => {
    const by = (say: string) => readRequest(say, "2026-11-14").homeBy;
    expect(by("dinner, home by 9")).toBe(21 * 60);
    expect(by("dinner, back before 8pm")).toBe(20 * 60);
    expect(by("lights, finished by 9:30")).toBe(21 * 60 + 30);
    expect(by("lights, no later than 10")).toBe(22 * 60);
  });

  it("reads budget, group, distance and time of day from one sentence", () => {
    const r = readRequest(
      "Family of 4 with two kids, lights and hot chocolate tomorrow evening, under $80, within 20 minutes",
      "2026-11-14",
    );
    expect(r).toMatchObject({
      party: "family",
      people: 4,
      kids: 2,
      budget: 80,
      day: "2026-11-15",
      time: "evening",
    });
    expect(r.reachKm).toBeGreaterThan(0);
  });
});
