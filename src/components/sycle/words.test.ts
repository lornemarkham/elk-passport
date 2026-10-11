import { describe, expect, it } from "vitest";
import type { BoardArrival } from "@/domain/sycle/board";
import { countdown, landsAt, statusLine } from "./words";

const NOW = new Date("2026-10-20T20:00:00Z"); // 13:00 in Vancouver

const row = (over: Partial<BoardArrival>): BoardArrival => ({
  id: "b",
  isYou: false,
  name: "Ana",
  flightNumber: null,
  from: { city: "London", code: "LHR", location: null },
  phase: "scheduled",
  verified: false,
  departs: { at: "2026-10-20T21:00:00Z", basis: "scheduled" },
  lands: { at: "2026-10-20T22:30:00Z", basis: "scheduled" },
  delayMinutes: null,
  km: 7600,
  estimated: null,
  reported: null,
  checkedAt: NOW.toISOString(),
  demo: false,
  ...over,
});

describe("board words", () => {
  it("counts down like a person", () => {
    expect(countdown(60_000)).toBe("any minute now");
    expect(countdown(23 * 60_000)).toBe("23 min");
    expect(countdown((4 * 60 + 5) * 60_000)).toBe("4h 05m");
    expect(countdown(50 * 3600_000)).toBe("2d 2h");
  });

  it("marks every time that has not happened yet", () => {
    expect(
      landsAt({ at: "2026-10-20T22:30:00Z", basis: "scheduled" }, NOW),
    ).toBe("15:30 sched.");
    expect(
      landsAt({ at: "2026-10-20T22:30:00Z", basis: "estimated" }, NOW),
    ).toBe("15:30 est.");
    expect(
      landsAt({ at: "2026-10-20T22:30:00Z", basis: "verified" }, NOW),
    ).toBe("15:30");
  });

  it("does not say 'in the air' for a flight nobody confirmed left", () => {
    expect(statusLine(row({ phase: "due-out" }), NOW)).toBe(
      "Should be on the way — not confirmed yet",
    );
    expect(statusLine(row({ phase: "airborne" }), NOW)).toMatch(
      /^In the air · lands 15:30 sched\./,
    );
  });
});
