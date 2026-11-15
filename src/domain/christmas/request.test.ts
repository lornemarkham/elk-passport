import { describe, expect, it } from "vitest";
import { readRequest, titleFor } from "./request";

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
