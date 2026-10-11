import "server-only";
import type {
  Airport,
  FlightRecord,
  FlightTimes,
  ProviderStatus,
} from "@/domain/sycle/flight";
import { readFlightNumber } from "@/domain/sycle/flight";
import type { FlightProvider } from "./types";

/**
 * **AeroDataBox, via RapidAPI.**
 *
 * Chosen for the pilot because it answers the question a person can actually
 * answer — *flight number and date* — for future dates as well as today,
 * worldwide, with airport coordinates, delays, cancellations, diversions and
 * a codeshare flag, on a commercial plan priced for 160 people (see
 * `docs/sycle/flight-data.md`).
 *
 * ## Not yet verified against the live API
 *
 * This adapter is written from AeroDataBox's published OpenAPI contract
 * (`doc.aerodatabox.com/docs/openapi-rapidapi-v1.json`); there is no key in
 * this checkout, so it has never seen a real response. `mapFlight` is pure
 * and tested against a payload in the documented shape. The first thing to do
 * with a key is one real lookup of a flight that is airborne, and a diff of
 * that payload against `aerodatabox.test.ts`.
 *
 * ## What "actual" means here
 *
 * AeroDataBox's `revisedTime` is an estimate until the movement happens and
 * the actual time afterwards; `runwayTime` is the wheels time when they have
 * it. So a time is mapped to `actual` only on `runwayTime`, or on `revisedTime`
 * once the *status* says the movement happened. Otherwise it is an estimate.
 */

const HOST = process.env.AERODATABOX_API_HOST ?? "aerodatabox.p.rapidapi.com";

export const aerodatabox = (key: string): FlightProvider => ({
  name: "aerodatabox",
  async lookup(flightNumber, date) {
    const url =
      `https://${HOST}/flights/number/${encodeURIComponent(flightNumber)}/${date}` +
      `?withAircraftImage=false&withLocation=true&dateLocalRole=Both`;
    const response = await fetch(url, {
      headers: { "X-RapidAPI-Key": key, "X-RapidAPI-Host": HOST },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    // 204 is "no such flight that day", which is an answer, not a failure.
    if (response.status === 204 || response.status === 404) return [];
    if (!response.ok) throw new Error(`AeroDataBox ${response.status}`);
    const body: unknown = await response.json();
    const now = new Date().toISOString();
    return (Array.isArray(body) ? body : [])
      .map((f) => mapFlight(f, date, now))
      .filter((f): f is FlightRecord => f !== null);
  },
});

// ------------------------------------------------------------------ mapping

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null;
const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;
const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/** `"2026-10-20 13:15Z"` → ISO. AeroDataBox writes a space, not a `T`. */
function utc(v: unknown): string | null {
  const s = str(obj(v)?.utc);
  if (!s) return null;
  const t = Date.parse(s.replace(" ", "T"));
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

function airport(v: unknown): Airport | null {
  const a = obj(v);
  if (!a) return null;
  const loc = obj(a.location);
  const lat = num(loc?.lat);
  const lon = num(loc?.lon);
  const name = str(a.name) ?? str(a.shortName) ?? str(a.iata) ?? str(a.icao);
  if (!name) return null;
  return {
    iata: str(a.iata),
    icao: str(a.icao),
    name,
    city: str(a.municipalityName),
    countryCode: str(a.countryCode),
    location:
      lat !== null && lon !== null ? { latitude: lat, longitude: lon } : null,
    timeZone: str(a.timeZone),
  };
}

const STATUS: Readonly<Record<string, ProviderStatus>> = {
  Expected: "scheduled",
  CheckIn: "scheduled",
  Boarding: "scheduled",
  GateClosed: "scheduled",
  Delayed: "delayed",
  Departed: "departed",
  EnRoute: "departed",
  Approaching: "departed",
  Arrived: "landed",
  Canceled: "cancelled",
  Diverted: "diverted",
  // "Probably cancelled" is not cancelled. Say nothing rather than guess.
  CanceledUncertain: "unknown",
  Unknown: "unknown",
};

function times(end: Obj, happened: boolean): FlightTimes {
  const scheduled = utc(end.scheduledTime);
  const revised = utc(end.revisedTime);
  const runway = utc(end.runwayTime);
  const predicted = utc(end.predictedTime);
  const actual = runway ?? (happened ? revised : null);
  return {
    scheduled,
    estimated: actual ? null : (revised ?? predicted),
    actual,
  };
}

export function mapFlight(
  v: unknown,
  date: string,
  fetchedAt: string,
): FlightRecord | null {
  const f = obj(v);
  if (!f) return null;
  if (f.isCargo === true) return null;
  const dep = obj(f.departure);
  const arr = obj(f.arrival);
  const from = airport(dep?.airport);
  const to = airport(arr?.airport);
  const number = readFlightNumber(str(f.number) ?? "");
  if (!dep || !arr || !from || !to || !number) return null;

  const status = STATUS[str(f.status) ?? "Unknown"] ?? "unknown";
  const departed =
    status === "departed" || status === "landed" || status === "diverted";
  const landed = status === "landed";

  const loc = obj(f.location);
  const lat = num(loc?.lat);
  const lon = num(loc?.lon);
  const reportedAt = utc({ utc: loc?.reportedAtUtc });

  const depTimes = times(dep, departed);
  return {
    key: `${number}|${depTimes.scheduled ?? date}|${from.iata ?? from.icao}`,
    flightNumber: number,
    operatedAs:
      str(f.codeshareStatus) === "IsCodeshared"
        ? (str(f.callSign) ?? null)
        : null,
    airline: str(obj(f.airline)?.name),
    date,
    departure: { airport: from, times: depTimes },
    arrival: { airport: to, times: times(arr, landed) },
    status,
    position:
      lat !== null && lon !== null && reportedAt
        ? {
            latitude: lat,
            longitude: lon,
            altitudeFt: num(obj(loc?.altitude)?.feet),
            reportedAt,
          }
        : null,
    source: "aerodatabox",
    fetchedAt,
  };
}
