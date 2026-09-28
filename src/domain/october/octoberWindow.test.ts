import { describe, expect, it } from "vitest";
import { octoberNow, octoberWindow } from "./octoberWindow";
import { localDay } from "@/domain/experience/eventTime";

describe("octoberWindow", () => {
  it("is the October of the year the viewer is in", () => {
    expect(octoberWindow(new Date("2026-09-27T20:00:00Z"))).toMatchObject({
      from: "2026-10-01",
      to: "2026-10-31",
      year: "2026",
    });
    expect(octoberWindow(new Date("2027-03-01T20:00:00Z")).from).toBe(
      "2027-10-01",
    );
  });

  it("uses the local year, not the UTC one, at a new-year boundary", () => {
    // 2027-01-01T03:00Z is still Dec 31 2026 in the Okanagan.
    expect(octoberWindow(new Date("2027-01-01T03:00:00Z")).year).toBe("2026");
  });
});

describe("octoberNow", () => {
  it("previews October from its first day before the month starts", () => {
    // Opened on Sep 27, the surface led Tonight with September's Culture Days
    // and offered a weekend that had already gone.
    const before = new Date("2026-09-27T20:00:00Z");
    expect(localDay(octoberNow(before))).toBe("2026-10-01");
  });

  it("passes the real instant through once October is under way", () => {
    for (const iso of [
      "2026-10-01T15:00:00Z",
      "2026-10-17T03:00:00Z",
      "2026-10-31T23:00:00Z",
    ]) {
      const now = new Date(iso);
      expect(octoberNow(now)).toBe(now);
    }
  });

  it("does not reach backwards from November", () => {
    // After the month, `now` is still later than Oct 1, so nothing is anchored
    // and the lanes go quiet on their own rather than replaying October.
    const after = new Date("2026-11-05T20:00:00Z");
    expect(octoberNow(after)).toBe(after);
  });

  it("anchors inside the day, not on its boundary", () => {
    // Midday UTC is the morning of Oct 1 in the Okanagan, so "tonight" is that
    // evening. An anchor at local midnight would sit on the edge of the day.
    expect(localDay(octoberNow(new Date("2026-09-01T20:00:00Z")))).toBe(
      "2026-10-01",
    );
  });
});
