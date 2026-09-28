import { describe, expect, it } from "vitest";
import { formatEventWhen, localDay, statedDay } from "./eventTime";

/**
 * **A date has no timezone, and Passport was giving it one.**
 *
 * A publisher states `2026-10-24`. Atlas stores `2026-10-24T00:00:00Z` and
 * records `timePrecision: "day"`. Passport localised that instant into
 * `America/Vancouver` — five hours before it, so **October 23rd at 5 p.m.** —
 * and 47 of October's 86 Events were a day early on every card and in every
 * bucket.
 *
 * These tests are about the semantic boundary, not about October: the same rule
 * has to hold for any date, any month, and any hour of an instant.
 */

describe("statedDay — the one rule", () => {
  it("keeps the publisher's calendar date for a stated date, whatever hour the instant is", () => {
    // Every one of these instants falls on Oct 24 in UTC and on Oct 23 or 24 in
    // Vancouver. Day precision must answer Oct 24 for all of them, because the
    // date is the fact and the hour is an artefact of how it was stored.
    for (const hour of ["00", "01", "06", "07", "12", "18", "23"]) {
      expect(statedDay(`2026-10-24T${hour}:00:00.000Z`, "day")).toBe(
        "2026-10-24",
      );
    }
  });

  it("is the boundary: the same instant localises to the day before", () => {
    // This is the defect, stated as a property. If these ever agree, the fix has
    // been undone or the zone has changed.
    expect(localDay("2026-10-24T00:00:00.000Z")).toBe("2026-10-23");
    expect(statedDay("2026-10-24T00:00:00.000Z", "day")).toBe("2026-10-24");
  });

  it("treats a stated clock as the instant it is", () => {
    // 2026-10-03T02:30Z is Oct 2, 7:30 p.m. in Vancouver — the evening the
    // publisher printed. Minute precision must not stop converting.
    expect(statedDay("2026-10-03T02:30:00.000Z", "minute")).toBe("2026-10-02");
    expect(statedDay("2026-10-03T02:30:00.000Z", "minute")).toBe(
      localDay("2026-10-03T02:30:00.000Z"),
    );
  });

  it("leaves an unknown precision exactly as it was, even at UTC midnight", () => {
    // Reading a midnight instant as evidence of a stated date is the inference
    // `timePrecision` exists to refuse. These stay localised.
    expect(statedDay("2026-10-18T00:00:00.000Z", undefined)).toBe("2026-10-17");
    expect(statedDay("2026-10-18T00:00:00.000Z")).toBe(
      localDay("2026-10-18T00:00:00.000Z"),
    );
  });

  it("works across a month, a year and a daylight-saving boundary", () => {
    expect(statedDay("2027-01-01T00:00:00.000Z", "day")).toBe("2027-01-01");
    // Vancouver leaves DST on Nov 1 2026; a stated date is unaffected either way.
    expect(statedDay("2026-11-01T00:00:00.000Z", "day")).toBe("2026-11-01");
    expect(statedDay("2026-03-08T00:00:00.000Z", "day")).toBe("2026-03-08");
  });

  it("says nothing when there is nothing to say", () => {
    expect(statedDay(undefined, "day")).toBe("");
    expect(statedDay("not a date", "day")).toBe("");
    expect(statedDay("", "minute")).toBe("");
  });
});

describe("formatEventWhen — a clock only where a publisher stated one", () => {
  it("prints the stated date and no time for day precision", () => {
    const when = formatEventWhen(
      "2026-10-24T00:00:00.000Z",
      "2026-10-24T00:00:00.000Z",
      "day",
    )!;
    expect(when).toContain("Oct 24");
    expect(when).toContain("2026");
    expect(when).not.toContain("Oct 23");
    // No invented hour, and no separator for one.
    expect(when).not.toMatch(/\d{1,2}:\d{2}/);
    expect(when).not.toContain("·");
  });

  it("prints both stated dates when a day-precision event spans days", () => {
    const when = formatEventWhen(
      "2026-09-26T00:00:00.000Z",
      "2026-10-04T00:00:00.000Z",
      "day",
    )!;
    expect(when).toContain("Sep 26");
    expect(when).toContain("Oct 4");
    expect(when).not.toMatch(/\d{1,2}:\d{2}/);
  });

  it("still prints the local clock for minute precision", () => {
    const when = formatEventWhen(
      "2026-10-03T02:30:00.000Z",
      "2026-10-03T04:30:00.000Z",
      "minute",
    )!;
    expect(when).toContain("Oct 2");
    expect(when).toMatch(/7:30/);
    expect(when).toMatch(/9:30/);
  });

  it("is unchanged when precision is unknown", () => {
    const withoutArgument = formatEventWhen(
      "2026-10-18T02:30:00.000Z",
      "2026-10-18T05:30:00.000Z",
    );
    const withUndefined = formatEventWhen(
      "2026-10-18T02:30:00.000Z",
      "2026-10-18T05:30:00.000Z",
      undefined,
    );
    expect(withUndefined).toBe(withoutArgument);
    expect(withoutArgument).toMatch(/7:30/);
  });
});
