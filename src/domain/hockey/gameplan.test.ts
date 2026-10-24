import { describe, expect, it } from "vitest";
import {
  DEFAULT_MEET_BEFORE_MINUTES,
  currentStop,
  arenaMeetingSpot,
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

const ARENA = "Outside Rogers Arena";

describe("one answer to where we meet — the pregame winner is the default", () => {
  it("the host's override beats everything", () => {
    const p = meetingPoint({
      official: "Gate 10",
      vote: item(["Stadium–Chinatown Station"]),
      dinner: item(["Chambar"]),
      arena: ARENA,
    });
    expect(p).toEqual({ value: "Gate 10", source: "host", decided: true });
    expect(meetingSourceLine(p)).toMatch(/host/);
  });
  it("the pregame restaurant is the meeting point: leading while it moves, decided when settled", () => {
    const leading = meetingPoint({
      dinner: item(["Chambar"]),
      members: 4,
      arena: ARENA,
    });
    expect(leading).toEqual({
      value: "Chambar",
      source: "pregame",
      decided: false,
    });
    expect(meetingSourceLine(leading)).toMatch(/Leading the pregame vote/);
    const closed = meetingPoint({
      dinner: { ...item(["Chambar"]), locked: true },
      arena: ARENA,
    });
    expect(closed).toMatchObject({ source: "pregame", decided: true });
    expect(meetingSourceLine(closed)).toMatch(/Pregame winner/);
    // Everybody going has voted: that settles it.
    expect(
      meetingPoint({
        dinner: { ...item(["Chambar"]), voters: 3 },
        members: 3,
        arena: ARENA,
      }).decided,
    ).toBe(true);
  });
  it("no second vote is needed, but an earlier settled one is not thrown away", () => {
    const settled = { ...item(["Terry Fox Plaza"]), locked: true };
    expect(meetingPoint({ vote: settled, arena: ARENA })).toEqual({
      value: "Terry Fox Plaza",
      source: "vote",
      decided: true,
    });
    // …until the pregame has a winner, which is the default now.
    expect(
      meetingPoint({
        vote: settled,
        dinner: item(["Chambar"]),
        arena: ARENA,
      }).value,
    ).toBe("Chambar");
    // An early lead in the old vote is not a decision.
    expect(
      meetingPoint({ vote: item(["A"]), members: 4, arena: ARENA }).source,
    ).toBe("arena");
  });
  it("a tie, nobody voting, or the concourse falls back to the arena, and says why", () => {
    const tie = meetingPoint({
      dinner: { ...item(["A", "B"]), locked: true },
      arena: ARENA,
    });
    expect(tie).toMatchObject({
      value: ARENA,
      source: "arena",
      tied: ["A", "B"],
    });
    expect(meetingSourceLine(tie)).toMatch(/tied \(A \/ B\)/);
    const nobody = meetingPoint({ arena: ARENA });
    expect(nobody).toEqual({ value: ARENA, source: "arena", decided: false });
    expect(meetingSourceLine(nobody)).toMatch(/Nobody has picked/);
    const concourse = meetingPoint({
      dinner: { ...item(["Just eat in the concourse"]), locked: true },
      concourseLabel: "Just eat in the concourse",
      arena: ARENA,
    });
    expect(concourse).toEqual({ value: ARENA, source: "arena", decided: true });
  });
});

describe("where to meet at the arena, for anyone skipping the pregame", () => {
  it("is the arena, with the closest landmark when one is right there", () => {
    const near = arenaMeetingSpot("Rogers Arena", [
      { name: "Stadium–Chinatown Station", km: 0.15, walkMinutes: 2 },
      { name: "Waterfront Station", km: 1.6, walkMinutes: 20 },
    ]);
    expect(near.value).toBe("Outside Rogers Arena");
    expect(near.detail).toMatch(/Stadium–Chinatown Station/);
    expect(near.detail).not.toMatch(/Waterfront/);
  });
  it("never invents a gate or a landmark", () => {
    const far = arenaMeetingSpot("Scotiabank Arena", [
      { name: "Union Station", km: 0.9, walkMinutes: 11 },
    ]);
    expect(far.value).toBe("Outside Scotiabank Arena");
    expect(far.detail).not.toMatch(/Union/);
    expect(far.detail).not.toMatch(/Gate \d/);
    expect(arenaMeetingSpot("Rogers Arena").value).toBe("Outside Rogers Arena");
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
