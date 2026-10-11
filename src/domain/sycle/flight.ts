/**
 * **A flight, as the arrival board is allowed to describe it.**
 *
 * The board's one hard rule is the mission's: *do not fabricate live aircraft
 * positions*. That rule is wider than positions. Every claim the board makes
 * about a flight is one of three kinds, and the type keeps them apart all the
 * way to the pixel — the doctrine's "signals, inference and truth are
 * different" (§5), applied to aeroplanes:
 *
 *   verified   the provider reported it happened (actual departure, landed)
 *   estimated  the provider published a revised time, or we interpolated
 *              along the route from published times — always labelled so
 *   scheduled  the timetable, which is a promise and not an observation
 *
 * Nothing here talks to a network. Providers adapt their payloads *into*
 * `FlightRecord`; everything the board shows is derived from it by the pure
 * functions below, which is what the tests pin.
 */
import { alongGreatCircle, greatCircleKm, type LatLon } from "./projection";

export interface Airport {
  readonly iata: string | null;
  readonly icao: string | null;
  readonly name: string;
  /** The city a person would say — "London", not "Heathrow". */
  readonly city: string | null;
  readonly countryCode: string | null;
  readonly location: LatLon | null;
  /** IANA zone, for showing local times at that end. */
  readonly timeZone: string | null;
}

/** ISO-8601 UTC instants. `null` is "not published", never "zero". */
export interface FlightTimes {
  readonly scheduled: string | null;
  /** A revised time the provider published, not one we computed. */
  readonly estimated: string | null;
  /** Reported as having happened. The only "verified" time. */
  readonly actual: string | null;
}

export interface FlightEnd {
  readonly airport: Airport;
  readonly times: FlightTimes;
}

/** What the provider says, mapped onto a small vocabulary. */
export type ProviderStatus =
  | "scheduled"
  | "delayed"
  | "departed"
  | "landed"
  | "cancelled"
  | "diverted"
  | "unknown";

/** A reported position. Only ever from a provider; never computed. */
export interface ReportedPosition extends LatLon {
  readonly altitudeFt: number | null;
  readonly reportedAt: string;
}

export interface FlightRecord {
  /** Provider's own key for this leg, stable across refreshes. */
  readonly key: string;
  /** As printed on the boarding pass, normalised: `AC855`. */
  readonly flightNumber: string;
  /** Where a marketing number is flown by someone else: `BA85 → AC855`. */
  readonly operatedAs: string | null;
  readonly airline: string | null;
  /** Departure date, local to the departure airport, `YYYY-MM-DD`. */
  readonly date: string;
  readonly departure: FlightEnd;
  readonly arrival: FlightEnd;
  readonly status: ProviderStatus;
  readonly position: ReportedPosition | null;
  /** Which provider answered. `demo` is never real and is always labelled. */
  readonly source: "aerodatabox" | "demo";
  readonly fetchedAt: string;
}

// -------------------------------------------------------------- reading input

/**
 * Read what someone typed into the flight box.
 *
 * Accepts the shapes people actually type — `AC 855`, `ac855`, `AC0855`,
 * `ACA855` (ICAO), `UA 9123` — and returns `AC855`. Leading zeros on the
 * number are dropped because boarding passes print them and providers don't.
 * `null` when it does not look like a flight number at all, so the form can
 * say so before spending a lookup.
 */
export function readFlightNumber(typed: string): string | null {
  const compact = typed.toUpperCase().replace(/[\s-]+/g, "");
  const m = /^([A-Z0-9]{2}[A-Z]?)(\d{1,4})([A-Z]?)$/.exec(compact);
  if (!m) return null;
  const [, airline, digits, suffix] = m;
  // Two-character IATA codes may contain a digit, but not two of them.
  if (/^\d\d/.test(airline!)) return null;
  const number = String(Number(digits));
  if (number === "0") return null;
  return `${airline}${number}${suffix}`;
}

/** `YYYY-MM-DD`, and a real calendar date. */
export function readFlightDate(typed: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(typed)) return null;
  const d = new Date(`${typed}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== typed
    ? null
    : typed;
}

// -------------------------------------------------------------- what is true

export type Basis = "verified" | "estimated" | "scheduled";

export interface Known {
  readonly at: string;
  readonly basis: Basis;
}

/** The best time we have for one end, and how we know it. */
export function bestTime(times: FlightTimes): Known | null {
  if (times.actual) return { at: times.actual, basis: "verified" };
  if (times.estimated) return { at: times.estimated, basis: "estimated" };
  if (times.scheduled) return { at: times.scheduled, basis: "scheduled" };
  return null;
}

/**
 * **Where the flight is in its day, and whether we actually know.**
 *
 * `airborne` and `landed` are only ever returned on the provider's word —
 * a reported actual time or a reported status. When the clock says the
 * aeroplane *should* have left but nobody has said it did, the answer is
 * `due-out`, which the board words as "should be on its way — not confirmed
 * yet". A late refresh must never be presented as a departure.
 */
export type Phase =
  "scheduled" | "due-out" | "airborne" | "landed" | "cancelled" | "diverted";

export function phaseOf(flight: FlightRecord, now: Date): Phase {
  if (flight.status === "cancelled") return "cancelled";
  if (flight.status === "diverted") return "diverted";
  if (flight.status === "landed" || flight.arrival.times.actual)
    return "landed";
  if (flight.status === "departed" || flight.departure.times.actual)
    return "airborne";
  const out = bestTime(flight.departure.times);
  if (out && Date.parse(out.at) <= now.getTime()) return "due-out";
  return "scheduled";
}

/** True only for the phases a provider confirmed. */
export const isVerified = (phase: Phase): boolean =>
  phase === "airborne" ||
  phase === "landed" ||
  phase === "cancelled" ||
  phase === "diverted";

/**
 * **How far along, by the clock — an estimate, and typed as one.**
 *
 * Fraction of elapsed block time between the best departure and arrival
 * times. Only computed for an `airborne` flight: before a confirmed
 * departure the honest progress is zero, and after landing it is one.
 * Real routes are not great circles — jet streams and oceanic tracks move
 * them hundreds of km — so the board shows this as a progress fraction and a
 * hollow marker, never as a tracked dot.
 */
export interface EstimatedProgress {
  readonly fraction: number;
  readonly at: LatLon | null;
  readonly basis: "estimated";
  /** The two times it was computed from, so the label can say so. */
  readonly from: Known;
  readonly to: Known;
}

export function estimatedProgress(
  flight: FlightRecord,
  now: Date,
): EstimatedProgress | null {
  if (phaseOf(flight, now) !== "airborne") return null;
  const from = bestTime(flight.departure.times);
  const to = bestTime(flight.arrival.times);
  if (!from || !to) return null;
  const start = Date.parse(from.at);
  const end = Date.parse(to.at);
  if (!(end > start)) return null;
  // Clamped below 1: an airborne flight past its arrival time is late, not
  // landed, and the marker should wait at the threshold rather than arrive.
  const fraction = Math.min(
    0.99,
    Math.max(0, (now.getTime() - start) / (end - start)),
  );
  const a = flight.departure.airport.location;
  const b = flight.arrival.airport.location;
  return {
    fraction,
    at: a && b ? alongGreatCircle(a, b, fraction) : null,
    basis: "estimated",
    from,
    to,
  };
}

export function routeKm(flight: FlightRecord): number | null {
  const a = flight.departure.airport.location;
  const b = flight.arrival.airport.location;
  return a && b ? Math.round(greatCircleKm(a, b)) : null;
}

/** Minutes between scheduled and best-known arrival. Positive is late. */
export function arrivalDelayMinutes(flight: FlightRecord): number | null {
  const s = flight.arrival.times.scheduled;
  const best = flight.arrival.times.actual ?? flight.arrival.times.estimated;
  if (!s || !best) return null;
  return Math.round((Date.parse(best) - Date.parse(s)) / 60000);
}

/** YVR, by either code. The board is about arriving *here*. */
export const landsInVancouver = (flight: FlightRecord): boolean =>
  flight.arrival.airport.iata === "YVR" ||
  flight.arrival.airport.icao === "CYVR";
