import { describe, expect, it } from "vitest";
import {
  arrivalDelayMinutes,
  estimatedProgress,
  phaseOf,
  readFlightDate,
  readFlightNumber,
  type FlightRecord,
} from "./flight";
import { refreshAfterMs } from "./refresh";

const T0 = Date.parse("2026-10-20T08:00:00Z");
const at = (h: number) => new Date(T0 + h * 3600_000);
const iso = (h: number) => at(h).toISOString();

export const flight = (over: Partial<FlightRecord> = {}): FlightRecord => ({
  key: "AC855|x|LHR",
  flightNumber: "AC855",
  operatedAs: null,
  airline: "Air Canada",
  date: "2026-10-20",
  departure: {
    airport: {
      iata: "LHR",
      icao: "EGLL",
      name: "Heathrow",
      city: "London",
      countryCode: "GB",
      location: { latitude: 51.47, longitude: -0.45 },
      timeZone: "Europe/London",
    },
    times: { scheduled: iso(0), estimated: null, actual: null },
  },
  arrival: {
    airport: {
      iata: "YVR",
      icao: "CYVR",
      name: "Vancouver International",
      city: "Vancouver",
      countryCode: "CA",
      location: { latitude: 49.19, longitude: -123.18 },
      timeZone: "America/Vancouver",
    },
    times: { scheduled: iso(10), estimated: null, actual: null },
  },
  status: "scheduled",
  position: null,
  source: "aerodatabox",
  fetchedAt: iso(-1),
  ...over,
});

describe("reading a typed flight number", () => {
  it.each([
    ["AC 855", "AC855"],
    ["ac855", "AC855"],
    ["AC0855", "AC855"],
    ["ACA855", "ACA855"],
    ["  ba-85 ", "BA85"],
    ["U2 8123", "U28123"],
    ["4U 123", "4U123"],
  ])("%s → %s", (typed, expected) => {
    expect(readFlightNumber(typed)).toBe(expected);
  });

  it.each(["", "855", "AC", "hello world", "AC 0", "12 345"])(
    "rejects %j",
    (typed) => {
      expect(readFlightNumber(typed)).toBeNull();
    },
  );

  it("only accepts real calendar dates", () => {
    expect(readFlightDate("2026-10-20")).toBe("2026-10-20");
    expect(readFlightDate("2026-02-30")).toBeNull();
    expect(readFlightDate("20/10/2026")).toBeNull();
  });
});

describe("what phase a flight is in — and whether we know", () => {
  it("is scheduled before its departure time", () => {
    expect(phaseOf(flight(), at(-1))).toBe("scheduled");
  });

  it("is never airborne on the clock alone", () => {
    // Departure time has passed, nobody has reported a departure.
    expect(phaseOf(flight(), at(3))).toBe("due-out");
  });

  it("is airborne only on a reported actual departure or status", () => {
    const off = flight({
      departure: {
        ...flight().departure,
        times: { scheduled: iso(0), estimated: null, actual: iso(0.2) },
      },
    });
    expect(phaseOf(off, at(3))).toBe("airborne");
    expect(phaseOf(flight({ status: "departed" }), at(3))).toBe("airborne");
  });

  it("is landed only on a reported arrival, even long past the scheduled time", () => {
    expect(phaseOf(flight({ status: "departed" }), at(30))).toBe("airborne");
    expect(phaseOf(flight({ status: "landed" }), at(30))).toBe("landed");
  });

  it("passes cancelled and diverted through", () => {
    expect(phaseOf(flight({ status: "cancelled" }), at(1))).toBe("cancelled");
    expect(phaseOf(flight({ status: "diverted" }), at(1))).toBe("diverted");
  });
});

describe("estimated progress", () => {
  it("does not exist until a departure is confirmed", () => {
    expect(estimatedProgress(flight(), at(5))).toBeNull();
  });

  it("is time elapsed between the best times, typed as an estimate", () => {
    const p = estimatedProgress(flight({ status: "departed" }), at(5))!;
    expect(p.basis).toBe("estimated");
    expect(p.fraction).toBeCloseTo(0.5, 5);
    expect(p.from.basis).toBe("scheduled");
    // Halfway LHR→YVR on the great circle is far north — over Greenland/Canada.
    expect(p.at!.latitude).toBeGreaterThan(60);
  });

  it("uses a published revised arrival over the timetable", () => {
    const late = flight({
      status: "departed",
      arrival: {
        ...flight().arrival,
        times: { scheduled: iso(10), estimated: iso(12), actual: null },
      },
    });
    expect(estimatedProgress(late, at(6))!.fraction).toBeCloseTo(0.5, 5);
    expect(arrivalDelayMinutes(late)).toBe(120);
  });

  it("waits at the threshold rather than arriving on its own", () => {
    expect(
      estimatedProgress(flight({ status: "departed" }), at(14))!.fraction,
    ).toBeLessThan(1);
  });
});

describe("refresh policy", () => {
  it("asks rarely far out, often near the movements, never once landed", () => {
    const H = 3600_000;
    expect(refreshAfterMs(flight(), at(-48))).toBe(24 * H);
    expect(refreshAfterMs(flight(), at(-10))).toBe(2 * H);
    expect(refreshAfterMs(flight(), at(-1))).toBe(15 * 60_000);
    expect(refreshAfterMs(flight({ status: "departed" }), at(3))).toBe(
      30 * 60_000,
    );
    expect(refreshAfterMs(flight({ status: "departed" }), at(9.5))).toBe(
      10 * 60_000,
    );
    expect(refreshAfterMs(flight({ status: "landed" }), at(11))).toBeNull();
    expect(refreshAfterMs(flight({ status: "cancelled" }), at(1))).toBeNull();
  });
});
