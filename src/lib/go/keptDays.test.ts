import { describe, expect, it } from "vitest";
import {
  decodeKeptDays,
  MAX_KEPT_DAYS,
  withKept,
  withoutStaleClock,
  type KeptDay,
} from "./keptDays";

const day = (id: string): KeptDay => ({
  id,
  title: `Day ${id}`,
  stops: ["a"],
  keptAt: "2026-10-11T12:00:00Z",
  href: "/go?say=x",
  memoryKey: "ghad.go:x",
  shaped: "{}",
  query: "stops=a",
});

describe("kept days", () => {
  it("keeping the same day twice is one day, newest first", () => {
    const once = withKept([day("a"), day("b")], day("b"));
    expect(once.map((d) => d.id)).toEqual(["b", "a"]);
  });

  it("is capped, dropping the oldest", () => {
    let all: readonly KeptDay[] = [];
    for (let i = 0; i < MAX_KEPT_DAYS + 3; i++)
      all = withKept(all, day(String(i)));
    expect(all).toHaveLength(MAX_KEPT_DAYS);
    expect(all[0]!.id).toBe(String(MAX_KEPT_DAYS + 2));
  });

  it("reads back only well-formed days, and only same-site addresses", () => {
    const raw = JSON.stringify([
      day("ok"),
      { ...day("offsite"), href: "https://evil.example/" },
      { nonsense: true },
    ]);
    expect(decodeKeptDays(raw).map((d) => d.id)).toEqual(["ok"]);
    expect(decodeKeptDays("not json")).toEqual([]);
    expect(decodeKeptDays(null)).toEqual([]);
  });

  it("does not carry a borrowed 'now' clock to another day", () => {
    const shaped = JSON.stringify({
      brief: { said: "x", startAt: 855, startsNow: true, hours: 4 },
      shaping: { order: ["a"] },
    });
    const back = JSON.parse(withoutStaleClock(shaped));
    expect(back.brief.startAt).toBeUndefined();
    expect(back.brief.hours).toBe(4);
    expect(back.shaping.order).toEqual(["a"]);
    const typed = JSON.stringify({ brief: { startAt: 600 } });
    expect(JSON.parse(withoutStaleClock(typed)).brief.startAt).toBe(600);
    // "This afternoon", built at 3:26 pm, reopens as the afternoon's start.
    const afternoon = JSON.stringify({
      brief: { startFromWhen: true, when: "afternoon", startAt: 15 * 60 + 30 },
    });
    expect(JSON.parse(withoutStaleClock(afternoon)).brief.startAt).toBeLessThan(
      15 * 60 + 30,
    );
  });
});
