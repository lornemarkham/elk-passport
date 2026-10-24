import { describe, expect, it } from "vitest";
import {
  DEFAULT_MEET_BEFORE_MINUTES,
  currentStop,
  meetOffsetMinutes,
  meetingPoint,
  meetingSourceLine,
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

describe("one answer to where we meet", () => {
  it("the host's official spot beats everything", () => {
    const p = meetingPoint({
      official: "Gate 10",
      vote: item(["Stadium–Chinatown Station"]),
      dinner: item(["Chambar"]),
    });
    expect(p).toEqual({ value: "Gate 10", source: "host" });
    expect(meetingSourceLine(p)).toMatch(/host/);
  });
  it("then the group's vote, a tie said as a tie", () => {
    expect(
      meetingPoint({ vote: item(["A"]), dinner: item(["Chambar"]) }),
    ).toEqual({ value: "A", source: "vote" });
    expect(meetingPoint({ vote: item(["A", "B"]) }).source).toBe("tied");
  });
  it("otherwise we meet where we eat — but not 'the concourse', and not a tie", () => {
    expect(meetingPoint({ vote: item([]), dinner: item(["Chambar"]) })).toEqual(
      {
        value: "Chambar",
        source: "dinner",
      },
    );
    expect(
      meetingPoint({
        dinner: item(["Just eat in the concourse"]),
        concourseLabel: "Just eat in the concourse",
      }).source,
    ).toBe("none");
    expect(meetingPoint({ dinner: item(["A", "B"]) }).source).toBe("none");
    expect(meetingPoint({}).value).toBe("Not decided yet");
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
