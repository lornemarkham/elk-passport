import { describe, expect, it } from "vitest";
import {
  getPassage,
  parsePassage,
  PASSAGE_KEY,
  remember,
  rememberPassage,
} from "./passage";

describe("parsePassage", () => {
  it("remembers nothing from nothing, or from garbage", () => {
    expect(parsePassage(null)).toEqual({});
    expect(parsePassage("")).toEqual({});
    expect(parsePassage("{not json")).toEqual({});
    expect(parsePassage("42")).toEqual({});
  });

  it("keeps only known keys holding real times", () => {
    expect(
      parsePassage(
        JSON.stringify({ tape: 5, escaped: "yes", refused: -1, extra: 9 }),
      ),
    ).toEqual({ tape: 5 });
  });
});

describe("remember", () => {
  it("the first time is the time", () => {
    const a = remember({}, "tape", 10);
    expect(a).toEqual({ tape: 10 });
    expect(remember(a, "tape", 99)).toBe(a);
  });
});

describe("rememberPassage", () => {
  it("writes through to storage and reads back", () => {
    window.localStorage.removeItem(PASSAGE_KEY);
    expect(getPassage()).toEqual({});
    rememberPassage("escaped", 1234);
    expect(getPassage()).toEqual({ escaped: 1234 });
    expect(JSON.parse(window.localStorage.getItem(PASSAGE_KEY)!)).toEqual({
      escaped: 1234,
    });
    window.localStorage.removeItem(PASSAGE_KEY);
  });
});
