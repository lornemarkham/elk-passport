import { describe, expect, it } from "vitest";
import {
  QUICK_UPDATES,
  channelFor,
  elapsed,
  leaveLine,
  lunchLine,
  parseStarted,
} from "./companion";
import { checkChallengeText } from "./challenges";

describe("companion", () => {
  it("a shared day's short updates go to chat (only the host may announce)", () => {
    expect(channelFor(true)).toBe("chat");
    expect(channelFor(false)).toBe("announce");
  });

  it("words lunch with or without a place", () => {
    expect(lunchLine("12:00", "Roundhouse Lodge")).toBe(
      "Lunch at 12:00 — Roundhouse Lodge. Meet there.",
    );
    expect(lunchLine("12:30", undefined)).toMatch(/Vote in the plan/);
  });

  it("leaves a margin, never a deadline", () => {
    const l = leaveLine(new Date(2026, 11, 12, 14, 0), 30);
    expect(l).toMatch(/2:30 pm/);
    expect(l).toMatch(/Say if you need longer/);
  });

  it("counts the day in hours and minutes", () => {
    const s = "2026-12-12T09:00:00";
    expect(elapsed(s, new Date("2026-12-12T09:07:00"))).toBe("7 min");
    expect(elapsed(s, new Date("2026-12-12T11:10:00"))).toBe("2 h 10 min");
    expect(elapsed(s, new Date("2026-12-12T08:00:00"))).toBe("0 min");
  });

  it("reads a stored start and rejects junk", () => {
    expect(parseStarted(null)).toBeNull();
    expect(parseStarted("nope")).toBeNull();
    expect(parseStarted('{"startedAt":"x"}')).toBeNull();
    expect(
      parseStarted('{"startedAt":"2026-12-12T09:00:00Z","endedAt":"bad"}'),
    ).toEqual({ startedAt: "2026-12-12T09:00:00Z" });
  });

  it("every canned update passes the same safety check as a crew challenge", () => {
    for (const q of QUICK_UPDATES) expect(checkChallengeText(q).ok).toBe(true);
  });
});
