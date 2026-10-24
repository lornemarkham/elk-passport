import { describe, expect, it } from "vitest";
import {
  DEFAULT_MEET_BEFORE_MINUTES,
  currentStop,
  meetOffsetMinutes,
  meetingPoint,
  meetingSourceLine,
  NOT_DECIDED,
} from "./gameplan";
import { crowdCounts, isWatching } from "./crowd";
import type { PlanItem } from "./plan";

const item = (leaders: string[], over: Partial<PlanItem> = {}): PlanItem => ({
  id: "x",
  label: "x",
  leaders,
  votes: leaders.length ? 2 : 0,
  voters: leaders.length ? 2 : 0,
  locked: false,
  open: true,
  ...over,
});

describe("where the night is", () => {
  it("dinner until warm-up, then meeting, the game from puck drop, then what's next", () => {
    expect(currentStop("before")).toBe("pregame");
    expect(currentStop("warmup")).toBe("meet");
    for (const p of ["live", "int1", "p2", "int2", "p3"])
      expect(currentStop(p)).toBe("game");
    for (const p of ["after", "morning", "again"])
      expect(currentStop(p)).toBe("after");
  });
});

describe("the meet-up time", () => {
  // 7:00 p.m. PDT on 25 October 2026.
  const PUCK = "2026-10-26T02:00:00Z";
  it("the host's time, as minutes before puck drop", () => {
    expect(meetOffsetMinutes(PUCK, "18:30")).toBe(-30);
    expect(meetOffsetMinutes(PUCK, "17:45")).toBe(-75);
  });
  it("half an hour before when the host hasn't said, or said nonsense", () => {
    expect(meetOffsetMinutes(PUCK, undefined)).toBe(
      -DEFAULT_MEET_BEFORE_MINUTES,
    );
    expect(meetOffsetMinutes(PUCK, "soon")).toBe(-DEFAULT_MEET_BEFORE_MINUTES);
    expect(meetOffsetMinutes(PUCK, "05:00")).toBe(-DEFAULT_MEET_BEFORE_MINUTES);
  });
});

describe("one answer to where we meet — never an assumption as a decision", () => {
  it("the host's official spot beats everything", () => {
    const p = meetingPoint({
      official: "Gate 10",
      vote: item(["Stadium–Chinatown Station"]),
      dinner: item(["Chambar"]),
    });
    expect(p).toEqual({ value: "Gate 10", source: "host", decided: true });
    expect(meetingSourceLine(p)).toMatch(/host/);
  });
  it("a settled meet-up vote is the group's; an early lead or a tie is not", () => {
    const settled = { ...item(["A"]), locked: true };
    expect(meetingPoint({ vote: settled, dinner: item(["Chambar"]) })).toEqual({
      value: "A",
      source: "vote",
      decided: true,
    });
    const early = meetingPoint({ vote: item(["A"]), members: 4 });
    expect(early).toMatchObject({
      value: NOT_DECIDED,
      source: "leading",
      decided: false,
    });
    expect(meetingSourceLine(early)).toMatch(/Leading the vote: A — not final/);
    expect(meetingPoint({ vote: item(["A", "B"]) })).toMatchObject({
      value: NOT_DECIDED,
      source: "tied",
    });
    // Everybody going has voted: that is a decision.
    expect(
      meetingPoint({ vote: { ...item(["A"]), voters: 3 }, members: 3 }).decided,
    ).toBe(true);
  });
  it("a restaurant the group chose is suggested, and says it is only a suggestion", () => {
    const chosen = { ...item(["Chambar"]), locked: true };
    const p = meetingPoint({ vote: item([]), dinner: chosen });
    expect(p).toEqual({ value: "Chambar", source: "dinner", decided: false });
    expect(meetingSourceLine(p)).toMatch(/^Suggested/);
    expect(meetingSourceLine(p)).toMatch(/Not confirmed/);
  });
  it("a dinner still being voted on, a tie, or the concourse suggests nothing", () => {
    expect(meetingPoint({ dinner: item(["Chambar"]), members: 4 })).toEqual({
      value: NOT_DECIDED,
      source: "none",
      decided: false,
    });
    expect(
      meetingPoint({
        dinner: { ...item(["Just eat in the concourse"]), locked: true },
        concourseLabel: "Just eat in the concourse",
      }).source,
    ).toBe("none");
    expect(
      meetingPoint({ dinner: { ...item(["A", "B"]), locked: true } }).source,
    ).toBe("none");
    expect(meetingPoint({}).value).toBe("Meeting point not decided.");
  });
});

describe("the peanut gallery", () => {
  it("counts the couch; anyone who hasn't said counts as going", () => {
    const crowd = {
      available: true,
      where: { a: "couch", b: "arena" } as const,
    };
    expect(crowdCounts(["a", "b", "c"], crowd)).toEqual({ arena: 2, couch: 1 });
    expect(isWatching("couch")).toBe(true);
    expect(isWatching("bar")).toBe(false);
  });
});
