import { describe, expect, it } from "vitest";
import { mapFlight } from "./aerodatabox";

/**
 * A payload in the shape AeroDataBox documents for
 * `GET /flights/number/{number}/{date}` (FlightContract, RapidAPI v1).
 * Written from the OpenAPI spec, **not captured from the live API** — the
 * first job with a real key is to replace this with a recorded response.
 */
const documented = (over: Record<string, unknown> = {}) => ({
  number: "AC 855",
  callSign: "ACA855",
  status: "EnRoute",
  codeshareStatus: "IsOperator",
  isCargo: false,
  airline: { name: "Air Canada", iata: "AC", icao: "ACA" },
  departure: {
    airport: {
      icao: "EGLL",
      iata: "LHR",
      name: "London Heathrow",
      shortName: "Heathrow",
      municipalityName: "London",
      location: { lat: 51.4706, lon: -0.461941 },
      countryCode: "GB",
      timeZone: "Europe/London",
    },
    scheduledTime: {
      utc: "2026-10-20 12:45Z",
      local: "2026-10-20 13:45+01:00",
    },
    revisedTime: { utc: "2026-10-20 13:02Z", local: "2026-10-20 14:02+01:00" },
    terminal: "2",
  },
  arrival: {
    airport: {
      icao: "CYVR",
      iata: "YVR",
      name: "Vancouver",
      municipalityName: "Vancouver",
      location: { lat: 49.1939, lon: -123.1844 },
      countryCode: "CA",
      timeZone: "America/Vancouver",
    },
    scheduledTime: {
      utc: "2026-10-20 22:30Z",
      local: "2026-10-20 15:30-07:00",
    },
    predictedTime: {
      utc: "2026-10-20 22:41Z",
      local: "2026-10-20 15:41-07:00",
    },
  },
  location: {
    lat: 62.1,
    lon: -40.2,
    altitude: { feet: 37000 },
    reportedAtUtc: "2026-10-20 16:10Z",
  },
  ...over,
});

const FETCHED = "2026-10-20T16:12:00.000Z";

describe("mapping AeroDataBox", () => {
  it("reads an en-route flight: departure is actual, arrival an estimate", () => {
    const f = mapFlight(documented(), "2026-10-20", FETCHED)!;
    expect(f.flightNumber).toBe("AC855");
    expect(f.status).toBe("departed");
    expect(f.departure.times.actual).toBe("2026-10-20T13:02:00.000Z");
    expect(f.departure.times.estimated).toBeNull();
    expect(f.arrival.times.actual).toBeNull();
    expect(f.arrival.times.estimated).toBe("2026-10-20T22:41:00.000Z");
    expect(f.departure.airport.city).toBe("London");
    expect(f.departure.airport.location).toEqual({
      latitude: 51.4706,
      longitude: -0.461941,
    });
    expect(f.position).toMatchObject({
      latitude: 62.1,
      longitude: -40.2,
      altitudeFt: 37000,
    });
  });

  it("treats a revised time before the movement as an estimate, not an actual", () => {
    const f = mapFlight(
      documented({ status: "Delayed", location: undefined }),
      "2026-10-20",
      FETCHED,
    )!;
    expect(f.status).toBe("delayed");
    expect(f.departure.times.actual).toBeNull();
    expect(f.departure.times.estimated).toBe("2026-10-20T13:02:00.000Z");
    expect(f.position).toBeNull();
  });

  it("does not turn 'probably cancelled' into cancelled", () => {
    expect(
      mapFlight(
        documented({ status: "CanceledUncertain" }),
        "2026-10-20",
        FETCHED,
      )!.status,
    ).toBe("unknown");
  });

  it("names the operator of a codeshare", () => {
    const f = mapFlight(
      documented({ number: "LH 6800", codeshareStatus: "IsCodeshared" }),
      "2026-10-20",
      FETCHED,
    )!;
    expect(f.operatedAs).toBe("ACA855");
  });

  it("drops cargo and anything without both airports", () => {
    expect(
      mapFlight(documented({ isCargo: true }), "2026-10-20", FETCHED),
    ).toBeNull();
    expect(
      mapFlight(documented({ arrival: {} }), "2026-10-20", FETCHED),
    ).toBeNull();
    expect(mapFlight("nonsense", "2026-10-20", FETCHED)).toBeNull();
  });
});
