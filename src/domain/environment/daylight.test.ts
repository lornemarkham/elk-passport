import { describe, expect, it } from "vitest";
import { OCTOBER_PLACES } from "./places";
import { daylightAt, isDarkAt, moonIllumination } from "./daylight";

/**
 * **Checked against an authority, not against itself.**
 *
 * An astronomical calculation that only agrees with its own output is a very
 * confident way to be wrong. Environment Canada publishes sunrise and sunset
 * for Vernon in the same response this product reads its forecast from, so the
 * numbers below are theirs — captured in `lib/environment/__fixtures__` — and
 * this file holds the calculation to them.
 */
const vernon = OCTOBER_PLACES.find((a) => a.id === "vernon")!;
const minutesApart = (a: Date, b: Date) =>
  Math.abs(a.getTime() - b.getTime()) / 60_000;

describe("against Environment Canada's published times", () => {
  it("puts Vernon's sunset within two minutes of theirs", () => {
    // Environment Canada, citypageweather bc-27, for 2026-10-01:
    //   sunset 2026-10-02T01:36:00Z  (18:36 local, PDT)
    const day = daylightAt(
      vernon.latitude,
      vernon.longitude,
      new Date("2026-10-01T12:00:00Z"),
    )!;
    expect(
      minutesApart(day.sunset, new Date("2026-10-02T01:36:00Z")),
    ).toBeLessThanOrEqual(2);
  });

  it("puts Vernon's sunrise within two minutes of theirs", () => {
    //   sunrise 2026-10-01T13:57:00Z  (06:57 local, PDT)
    const day = daylightAt(
      vernon.latitude,
      vernon.longitude,
      new Date("2026-10-01T12:00:00Z"),
    )!;
    expect(
      minutesApart(day.sunrise, new Date("2026-10-01T13:57:00Z")),
    ).toBeLessThanOrEqual(2);
  });
});

describe("the shape of October", () => {
  it("loses daylight across the month, which is the whole feeling", () => {
    const first = daylightAt(
      vernon.latitude,
      vernon.longitude,
      new Date("2026-10-01T12:00:00Z"),
    )!;
    const last = daylightAt(
      vernon.latitude,
      vernon.longitude,
      new Date("2026-10-31T12:00:00Z"),
    )!;
    expect(last.daylightMinutes).toBeLessThan(first.daylightMinutes);
    // Roughly three minutes a day at this latitude.
    const lost = first.daylightMinutes - last.daylightMinutes;
    expect(lost).toBeGreaterThan(70);
    expect(lost).toBeLessThan(120);
  });

  it("answers for every area this product serves", () => {
    for (const area of OCTOBER_PLACES) {
      const day = daylightAt(
        area.latitude,
        area.longitude,
        new Date("2026-10-15T12:00:00Z"),
      );
      expect(day, area.id).toBeDefined();
      expect(day!.sunset.getTime(), area.id).toBeGreaterThan(
        day!.sunrise.getTime(),
      );
    }
  });

  it("is deterministic across a local day", () => {
    // Anchored at midday, as the doc comment asks callers to do. An instant
    // at 03:00 UTC is the *previous* evening in Vernon, and resolving to a
    // different day for it is correct rather than a wobble.
    const a = daylightAt(
      vernon.latitude,
      vernon.longitude,
      new Date("2026-10-09T16:00:00Z"),
    );
    const b = daylightAt(
      vernon.latitude,
      vernon.longitude,
      new Date("2026-10-09T23:00:00Z"),
    );
    expect(a!.sunset.toISOString()).toBe(b!.sunset.toISOString());
  });
});

describe("is it dark", () => {
  it("is dark an hour after sunset and light an hour before it", () => {
    const day = daylightAt(
      vernon.latitude,
      vernon.longitude,
      new Date("2026-10-09T12:00:00Z"),
    )!;
    const after = new Date(day.sunset.getTime() + 3_600_000);
    const before = new Date(day.sunset.getTime() - 3_600_000);
    expect(isDarkAt(vernon.latitude, vernon.longitude, after)).toBe(true);
    expect(isDarkAt(vernon.latitude, vernon.longitude, before)).toBe(false);
  });

  it("is dark before sunrise", () => {
    const day = daylightAt(
      vernon.latitude,
      vernon.longitude,
      new Date("2026-10-09T12:00:00Z"),
    )!;
    const before = new Date(day.sunrise.getTime() - 3_600_000);
    expect(isDarkAt(vernon.latitude, vernon.longitude, before)).toBe(true);
  });
});

describe("the moon, because of meteors", () => {
  it("is near new when Atlas says a new moon is near", () => {
    // Atlas holds this as a keyFact on the Draconids: "New moon is 15:50 UTC
    // on October 10." A near-new moon is the reason the shower is worth
    // mentioning at all this year.
    expect(moonIllumination(new Date("2026-10-10T15:50:00Z"))).toBeLessThan(
      0.08,
    );
  });

  it("is near full a fortnight either side of that", () => {
    expect(moonIllumination(new Date("2026-10-25T15:50:00Z"))).toBeGreaterThan(
      0.9,
    );
  });

  it("stays between none and all of it", () => {
    for (let day = 1; day <= 31; day++) {
      const lit = moonIllumination(
        new Date(`2026-10-${String(day).padStart(2, "0")}T06:00:00Z`),
      );
      expect(lit).toBeGreaterThanOrEqual(0);
      expect(lit).toBeLessThanOrEqual(1);
    }
  });
});
