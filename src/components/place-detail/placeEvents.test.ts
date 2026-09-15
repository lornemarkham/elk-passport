import { describe, expect, it } from "vitest";
import { formatRange } from "./PlaceEvents";

/**
 * The dates are the publisher's; only their rendering is Passport's. The
 * shapes are the real ones Atlas sent on 2026-09-15.
 */
describe("formatRange", () => {
  const now = new Date("2026-09-15T12:00:00Z");

  it("renders a one-day event as one day", () => {
    expect(
      formatRange("2026-09-17T02:30:00.000Z", "2026-09-17T05:00:00.000Z", now),
    ).toBe("Sep 16");
  });

  it("renders a span as a range", () => {
    // Davison Orchards' Apple Harvest Fest, as stated.
    expect(
      formatRange("2026-08-28T07:00:00.000Z", "2026-10-01T06:59:59.000Z", now),
    ).toBe("Aug 28 – Sep 30");
  });

  it("names the year only when it is not this one", () => {
    expect(
      formatRange("2027-10-01T07:00:00.000Z", "2027-10-26T07:00:00.000Z", now),
    ).toBe("Oct 1 – Oct 26, 2027");
  });

  it("says nothing for a date it cannot read, rather than 'Invalid Date'", () => {
    expect(formatRange("not a date", undefined, now)).toBe("");
    expect(formatRange(undefined, undefined, now)).toBe("");
  });
});
