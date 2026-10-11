import type { Airport, FlightRecord } from "@/domain/sycle/flight";
import type { FlightProvider } from "./types";

/**
 * **A pretend airline, for building the board without a key.**
 *
 * Switched on only by `SYCLE_FLIGHT_PROVIDER=demo` and never by the absence
 * of a key — a missing key in production must read as "lookup isn't
 * connected", not as a board full of invented aeroplanes. Every record it
 * returns has `source: "demo"`, and the UI stamps those as **DEMO** wherever
 * they appear.
 *
 * Any well-formed flight number works. The origin is picked from the number,
 * and the times are placed relative to the clock so that a handful of numbers
 * give you every phase at once: the last digit decides where in its journey
 * the flight is right now.
 */
const A = (
  iata: string,
  city: string,
  name: string,
  latitude: number,
  longitude: number,
  timeZone: string,
  countryCode: string,
): Airport => ({
  iata,
  icao: null,
  name,
  city,
  countryCode,
  location: { latitude, longitude },
  timeZone,
});

export const DEMO_ORIGINS: readonly Airport[] = [
  A("LHR", "London", "Heathrow", 51.47, -0.45, "Europe/London", "GB"),
  A(
    "FRA",
    "Frankfurt",
    "Frankfurt am Main",
    50.03,
    8.57,
    "Europe/Berlin",
    "DE",
  ),
  A("AMS", "Amsterdam", "Schiphol", 52.31, 4.76, "Europe/Amsterdam", "NL"),
  A("NRT", "Tokyo", "Narita", 35.77, 140.39, "Asia/Tokyo", "JP"),
  A(
    "SYD",
    "Sydney",
    "Kingsford Smith",
    -33.94,
    151.18,
    "Australia/Sydney",
    "AU",
  ),
  A("AKL", "Auckland", "Auckland", -37.01, 174.79, "Pacific/Auckland", "NZ"),
  A("SIN", "Singapore", "Changi", 1.36, 103.99, "Asia/Singapore", "SG"),
  A("DEL", "Delhi", "Indira Gandhi", 28.56, 77.1, "Asia/Kolkata", "IN"),
  A(
    "JFK",
    "New York",
    "John F. Kennedy",
    40.64,
    -73.78,
    "America/New_York",
    "US",
  ),
  A("YYZ", "Toronto", "Pearson", 43.68, -79.63, "America/Toronto", "CA"),
  A(
    "MEX",
    "Mexico City",
    "Benito Juárez",
    19.44,
    -99.07,
    "America/Mexico_City",
    "MX",
  ),
  A("GRU", "São Paulo", "Guarulhos", -23.43, -46.47, "America/Sao_Paulo", "BR"),
  A(
    "DFW",
    "Dallas",
    "Dallas/Fort Worth",
    32.9,
    -97.04,
    "America/Chicago",
    "US",
  ),
  A("KEF", "Reykjavík", "Keflavík", 63.98, -22.61, "Atlantic/Reykjavik", "IS"),
];

const YVR: Airport = A(
  "YVR",
  "Vancouver",
  "Vancouver International",
  49.1947,
  -123.1792,
  "America/Vancouver",
  "CA",
);

const hash = (s: string) =>
  [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

const MIN = 60_000;

/** Block time at a rough 800 km/h plus taxi, so the demo looks plausible. */
function blockMinutes(from: Airport): number {
  const a = from.location!;
  const b = YVR.location!;
  const R = 6371;
  const toRad = Math.PI / 180;
  const d =
    2 *
    R *
    Math.asin(
      Math.sqrt(
        Math.sin(((b.latitude - a.latitude) * toRad) / 2) ** 2 +
          Math.cos(a.latitude * toRad) *
            Math.cos(b.latitude * toRad) *
            Math.sin(((b.longitude - a.longitude) * toRad) / 2) ** 2,
      ),
    );
  return Math.round((d / 800) * 60 + 30);
}

export function demoFlight(
  flightNumber: string,
  date: string,
  now: Date,
): FlightRecord {
  const h = hash(flightNumber);
  const from = DEMO_ORIGINS[h % DEMO_ORIGINS.length]!;
  const block = blockMinutes(from);
  const stage = Number(flightNumber.replace(/\D/g, "").slice(-1));
  // 0–1 landed, 2–5 airborne at various points, 6 delayed, 7 cancelled,
  // 8–9 later. Positive offsets are block-times *ago*.
  // Anchored to "now" when the date is today, else to the date.
  const today = now.toISOString().slice(0, 10);
  const anchor =
    date === today ? now.getTime() : Date.parse(`${date}T17:00:00Z`);
  const offsets = [1.4, 1.1, 0.2, 0.45, 0.7, 0.92, -0.1, -0.2, -2.5, -6];
  const depart = anchor - (offsets[stage] ?? -3) * block * MIN;
  const arrive = depart + block * MIN;
  const past = (t: number) => t <= now.getTime();
  const iso = (t: number) => new Date(t).toISOString();
  const cancelled = stage === 7;
  const delayed = stage === 6;
  const slip = delayed ? 95 * MIN : 0;
  return {
    key: `${flightNumber}|${date}|${from.iata}`,
    flightNumber,
    operatedAs: null,
    airline: "Demo Air",
    date,
    departure: {
      airport: from,
      times: {
        scheduled: iso(depart),
        estimated: delayed ? iso(depart + slip) : null,
        actual: !cancelled && past(depart + slip) ? iso(depart + slip) : null,
      },
    },
    arrival: {
      airport: YVR,
      times: {
        scheduled: iso(arrive),
        estimated: delayed ? iso(arrive + slip) : null,
        actual: !cancelled && past(arrive + slip) ? iso(arrive + slip) : null,
      },
    },
    status: cancelled
      ? "cancelled"
      : past(arrive + slip)
        ? "landed"
        : past(depart + slip)
          ? "departed"
          : delayed
            ? "delayed"
            : "scheduled",
    position: null,
    source: "demo",
    fetchedAt: now.toISOString(),
  };
}

export const demo: FlightProvider = {
  name: "demo",
  async lookup(flightNumber, date) {
    return [demoFlight(flightNumber, date, new Date())];
  },
};
