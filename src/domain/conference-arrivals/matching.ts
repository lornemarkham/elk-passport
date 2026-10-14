/**
 * **Is that aircraft this person's flight? Only when the evidence says so.**
 *
 * The rule is the mission's: *never attach a coworker's name to an uncertain
 * aircraft*. A wrong match is much worse than a slow one, because it puts a
 * real person's name on a stranger's aeroplane and draws it moving. So this
 * decides by checks, each of which says in words what it saw, and identifies
 * an aircraft only when every required check passes and exactly one aircraft
 * does.
 *
 * ```
 * callsign   the aircraft broadcasts a callsign the flight number maps to
 * privacy    it is not in a privacy programme (LADD / PIA)
 * airborne   it is in the air, with a decoded position
 * fresh      that position is under a minute old
 * date       now is a time this flight, on the date given, could be flying
 * corridor   the position lies along the great circle of the leg into the
 *            conference's airport, inside a band that allows for real
 *            routings (jet streams, oceanic tracks)
 * heading    it is pointed at that airport (or is already on approach)
 * route      the public route record for the callsign ends at that airport
 *            and includes the departure the person gave
 * unique     no other aircraft passes the same checks
 * ```
 *
 * `route` is required for an *operator* callsign (a regional flying the
 * number under its own designator), because those designators are shared
 * between several airlines' numbers. For the airline's own callsign a
 * missing route record is acceptable. A record whose *destination* differs
 * (they go stale) is outweighed only once the aircraft is close enough to
 * the airport, and pointed at it, that no other destination fits. A record
 * that contradicts the departure the person gave is never outweighed: that
 * is what a mistyped flight number looks like.
 *
 * Pure: everything it knows arrives as arguments.
 */
import type { AdsbSnapshot, Observation, RouteRecord } from "./adsb";
import type { CallsignCandidate, FlightIdent } from "./flight";
import {
  bearingDeg,
  distanceKm,
  headingGap,
  relativeToRoute,
  type LatLon,
} from "./geo";

export interface Airport extends LatLon {
  readonly icao: string;
  readonly iata: string | null;
  readonly name: string;
  readonly city: string | null;
}

/** What the coworker told us. */
export interface FlightClaim {
  readonly ident: FlightIdent;
  /** Departure date, local to the departure airport. */
  readonly date: string;
  readonly departure: Airport | null;
  /** The conference's airport. Not a constant: see `arrivalAirportFor`. */
  readonly arrival: Airport;
}

/** One callsign looked up. `snapshot: null` means the lookup itself failed. */
export interface Search {
  readonly candidate: CallsignCandidate;
  readonly snapshot: AdsbSnapshot | null;
  readonly route: RouteRecord | null;
}

export type Check =
  | "callsign"
  | "privacy"
  | "airborne"
  | "fresh"
  | "date"
  | "route"
  | "corridor"
  | "heading"
  | "unique";

export interface Evidence {
  readonly check: Check;
  readonly result: "pass" | "fail" | "unknown";
  /** One plain sentence about what was seen. Shown to the person. */
  readonly says: string;
}

export interface Leg {
  readonly from: Airport;
  readonly to: Airport;
  /** Where `from` came from: what the person said, or the route record. */
  readonly fromBasis: "stated" | "route-record";
}

export type WaitReason =
  | "no-callsign"
  | "too-early"
  | "too-late"
  | "feed-unavailable"
  | "not-heard"
  | "on-ground"
  | "need-departure"
  | "weak-evidence"
  | "ambiguous";

export type Decision =
  | {
      readonly kind: "identified";
      readonly aircraft: Observation;
      readonly candidate: CallsignCandidate;
      readonly leg: Leg;
      readonly evidence: readonly Evidence[];
    }
  | {
      readonly kind: "waiting";
      readonly reason: WaitReason;
      /** The sentence under "Waiting to identify your aircraft." */
      readonly says: string;
      /** The closest call, when there was one, so the reason is checkable. */
      readonly evidence: readonly Evidence[];
    };

// Thresholds, named so the tests and the docs can point at them.
export const FRESH_SECONDS = 60;
export const CORRIDOR_MIN_KM = 150;
export const CORRIDOR_FRACTION = 0.12;
export const HEADING_TOLERANCE_DEG = 70;
export const APPROACH_KM = 60;
/** Climbing faster than this near the airport is leaving it. */
export const CLIMBING_FPM = 300;
/** Inside this, pointed at the airport, nowhere else fits. */
export const CONVERGED_KM = 500;

const HOUR = 3_600_000;

const placeName = (a: Airport) => a.city ?? a.name;
const code = (a: Airport) => a.iata ?? a.icao;

/**
 * When a flight on local date `date` could be in the air. Generous on
 * purpose: this rules out a different day's flight with the same number, it
 * does not pretend to know the timetable. With a known departure airport the
 * time zone is approximated from its longitude, ±3 h.
 */
export function flightWindow(
  date: string,
  departure: Airport | null,
  arrival: Airport,
): { opens: Date; closes: Date } {
  const dayStart = Date.parse(`${date}T00:00:00Z`);
  const dayEnd = dayStart + 24 * HOUR;
  if (!departure)
    return {
      opens: new Date(dayStart - 14 * HOUR),
      closes: new Date(dayEnd + 12 * HOUR + 20 * HOUR),
    };
  const offset = Math.max(-12, Math.min(14, Math.round(departure.lon / 15)));
  const hours = distanceKm(departure, arrival) / 700 + 2;
  return {
    opens: new Date(dayStart - (offset + 3) * HOUR),
    closes: new Date(dayEnd - (offset - 3) * HOUR + hours * HOUR),
  };
}

interface Assessment {
  readonly aircraft: Observation;
  readonly candidate: CallsignCandidate;
  readonly evidence: Evidence[];
  readonly leg: Leg | null;
  readonly eligible: boolean;
  /** `YYC → YVR`, when there was a route record. */
  readonly routeDescribed: string | null;
  /** How many required checks passed, to pick the closest call to explain. */
  readonly score: number;
}

function assess(
  claim: FlightClaim,
  search: Search,
  aircraft: Observation,
  snapshotAt: string,
  now: Date,
): Assessment {
  const { candidate, route } = search;
  const evidence: Evidence[] = [];
  const add = (check: Check, result: Evidence["result"], says: string) =>
    evidence.push({ check, result, says });

  add(
    "callsign",
    "pass",
    candidate.kind === "direct"
      ? `Broadcasting ${candidate.callsign}, ${candidate.operator}'s own callsign for ${claim.ident.display}.`
      : `Broadcasting ${candidate.callsign}: ${candidate.operator} often flies ${claim.ident.display} under that callsign.`,
  );

  add(
    "privacy",
    aircraft.privacyListed ? "fail" : "pass",
    aircraft.privacyListed
      ? "This aircraft is in a privacy programme. Passport won't put a name on it."
      : "Not in an aircraft privacy programme.",
  );

  const pos = aircraft.position;
  if (aircraft.onGround) add("airborne", "fail", "On the ground.");
  else if (!pos) add("airborne", "fail", "Heard, but without a position.");
  else
    add(
      "airborne",
      "pass",
      `In the air${aircraft.altitudeFt !== null ? ` at ${aircraft.altitudeFt.toLocaleString("en-CA")} ft` : ""}.`,
    );

  const ageS = aircraft.positionAt
    ? (Date.parse(snapshotAt) - Date.parse(aircraft.positionAt)) / 1000
    : null;
  add(
    "fresh",
    ageS !== null && ageS <= FRESH_SECONDS ? "pass" : "fail",
    ageS === null ? "No position time." : `Position ${Math.round(ageS)} s old.`,
  );

  const window = flightWindow(claim.date, claim.departure, claim.arrival);
  const t = now.getTime();
  add(
    "date",
    t >= window.opens.getTime() && t <= window.closes.getTime()
      ? "pass"
      : "fail",
    t < window.opens.getTime() || t > window.closes.getTime()
      ? `A flight dated ${claim.date} can't be in the air now.`
      : `A flight dated ${claim.date} could be in the air now.`,
  );

  // The route record, and the leg into the conference's airport.
  let routeResult: Evidence["result"] = "unknown";
  // The record disagrees with where the person said they're flying from.
  // That points at a typo in the flight number, and nothing overrides it.
  let contradictsDeparture = false;
  let routeDescribed: string | null = null;
  let leg: Leg | null = claim.departure
    ? { from: claim.departure, to: claim.arrival, fromBasis: "stated" }
    : null;
  if (!route) {
    add(
      "route",
      "unknown",
      `No public route record for ${candidate.callsign}.`,
    );
  } else {
    const stops = route.airports;
    const last = stops[stops.length - 1]!;
    const before = stops.slice(0, -1);
    const endsHere = last.icao === claim.arrival.icao;
    const fromOk =
      !claim.departure || before.some((a) => a.icao === claim.departure!.icao);
    const described = stops.map((a) => a.iata ?? a.icao).join(" → ");
    routeDescribed = described;
    routeResult = endsHere && fromOk ? "pass" : "fail";
    contradictsDeparture = !fromOk;
    add(
      "route",
      routeResult,
      routeResult === "pass"
        ? `Route record for ${candidate.callsign}: ${described}.`
        : `Route record for ${candidate.callsign} says ${described}, not ${claim.departure ? `${code(claim.departure)} → ` : "into "}${code(claim.arrival)}.`,
    );
    if (routeResult === "pass") {
      const prior = before[before.length - 1]!;
      leg = {
        from: {
          icao: prior.icao,
          iata: prior.iata,
          name: prior.name,
          city: prior.city,
          lat: prior.lat,
          lon: prior.lon,
        },
        to: claim.arrival,
        fromBasis:
          claim.departure && claim.departure.icao === prior.icao
            ? "stated"
            : "route-record",
      };
    }
  }

  const toArrival = pos ? distanceKm(pos, claim.arrival) : null;
  if (!pos || !leg) {
    add(
      "corridor",
      "unknown",
      leg
        ? "No position to check against the route."
        : "No departure airport to check the route against.",
    );
  } else {
    const r = relativeToRoute(pos, leg.from, leg.to);
    const band = Math.max(CORRIDOR_MIN_KM, CORRIDOR_FRACTION * r.routeKm);
    const along = r.alongKm >= -50 && r.alongKm <= r.routeKm + 50;
    const ok = r.crossKm <= band && along;
    add(
      "corridor",
      ok ? "pass" : "fail",
      ok
        ? `${Math.round(r.crossKm)} km off the ${code(leg.from)} → ${code(leg.to)} great circle, ${Math.round(toArrival!)} km out.`
        : `${Math.round(r.crossKm)} km off the ${code(leg.from)} → ${code(leg.to)} route${along ? "" : ", and not between the two airports"}.`,
    );
  }

  if (!pos || toArrival === null) {
    add("heading", "unknown", "No position.");
  } else if (toArrival <= APPROACH_KM) {
    // Approach patterns point every which way, so near the airport the
    // test is "not leaving": descending or level, or else pointed at it. A
    // departure climbing out of the same airport fails both.
    const rate = aircraft.verticalRateFpm;
    const gap =
      aircraft.trackDeg === null
        ? null
        : headingGap(aircraft.trackDeg, bearingDeg(pos, claim.arrival));
    const arriving =
      (rate !== null && rate <= CLIMBING_FPM) || (gap !== null && gap <= 90);
    add(
      "heading",
      arriving ? "pass" : rate === null && gap === null ? "unknown" : "fail",
      arriving
        ? `${Math.round(toArrival)} km from ${placeName(claim.arrival)}${rate !== null && rate < -CLIMBING_FPM ? ", descending" : ""}: on approach.`
        : `${Math.round(toArrival)} km from ${placeName(claim.arrival)} but climbing away from it.`,
    );
  } else if (aircraft.trackDeg === null) {
    add("heading", "unknown", "No track reported.");
  } else {
    const gap = headingGap(aircraft.trackDeg, bearingDeg(pos, claim.arrival));
    add(
      "heading",
      gap <= HEADING_TOLERANCE_DEG ? "pass" : "fail",
      gap <= HEADING_TOLERANCE_DEG
        ? `Heading for ${code(claim.arrival)} (${Math.round(gap)}° off).`
        : `Pointed ${Math.round(gap)}° away from ${code(claim.arrival)}.`,
    );
  }

  const result = (c: Check) =>
    evidence.find((e) => e.check === c)?.result ?? "unknown";
  const required: Check[] = [
    "privacy",
    "airborne",
    "fresh",
    "date",
    "corridor",
    "heading",
  ];
  const routeOk =
    candidate.kind === "operator"
      ? routeResult === "pass"
      : routeResult !== "fail" ||
        (!contradictsDeparture &&
          toArrival !== null &&
          toArrival <= CONVERGED_KM &&
          result("heading") === "pass");
  const passed = required.filter((c) => result(c) === "pass").length;
  return {
    aircraft,
    candidate,
    evidence,
    leg,
    routeDescribed,
    eligible: passed === required.length && routeOk,
    score: passed + (routeOk ? 1 : 0),
  };
}

export function decide(
  claim: FlightClaim,
  searches: readonly Search[],
  now: Date,
): Decision {
  const waiting = (
    reason: WaitReason,
    says: string,
    evidence: readonly Evidence[] = [],
  ): Decision => ({ kind: "waiting", reason, says, evidence });

  if (searches.length === 0)
    return waiting(
      "no-callsign",
      `Passport doesn't know the radio callsign for ${claim.ident.display}. If you know the airline's three-letter code, type it that way (like ACA855).`,
    );

  const window = flightWindow(claim.date, claim.departure, claim.arrival);
  if (now < window.opens)
    return waiting(
      "too-early",
      `Your flight is on ${claim.date}. We'll start looking when it could be in the air.`,
    );
  if (now > window.closes)
    return waiting(
      "too-late",
      `A flight dated ${claim.date} should be on the ground by now. We never saw it in the air.`,
    );

  const answered = searches.filter((s) => s.snapshot !== null);
  if (answered.length === 0)
    return waiting(
      "feed-unavailable",
      "The ADS-B feed isn't answering right now. We'll keep trying.",
    );

  const assessed = answered.flatMap((s) =>
    s
      .snapshot!.aircraft.filter((a) => a.callsign === s.candidate.callsign)
      .map((a) => assess(claim, s, a, s.snapshot!.at, now)),
  );
  const callsigns = searches.map((s) => s.candidate.callsign).join(", ");
  if (assessed.length === 0)
    return waiting(
      "not-heard",
      `Nothing is broadcasting ${callsigns} within range of ADS-B receivers right now. Over oceans and remote land, that's normal.`,
    );

  const eligible = assessed.filter((a) => a.eligible);
  const hexes = [...new Set(eligible.map((a) => a.aircraft.hex))];
  if (hexes.length > 1)
    return waiting(
      "ambiguous",
      `${hexes.length} aircraft fit ${claim.ident.display} equally well. Passport won't guess which one you're on.`,
      [
        {
          check: "unique",
          result: "fail",
          says: `${hexes.length} aircraft pass every check.`,
        },
      ],
    );
  if (hexes.length === 1) {
    const best = eligible[0]!;
    return {
      kind: "identified",
      aircraft: best.aircraft,
      candidate: best.candidate,
      leg: best.leg!,
      evidence: [
        ...best.evidence,
        {
          check: "unique",
          result: "pass",
          says: "No other aircraft fits.",
        },
      ],
    };
  }

  const closest = [...assessed].sort((a, b) => b.score - a.score)[0]!;
  const failed = (c: Check) =>
    closest.evidence.find((e) => e.check === c)?.result !== "pass";
  if (closest.aircraft.onGround)
    return waiting(
      "on-ground",
      `${closest.candidate.callsign} is on the ground. We'll pick it up once it's in the air.`,
      closest.evidence,
    );
  if (!closest.leg)
    return waiting(
      "need-departure",
      `Something is broadcasting ${closest.candidate.callsign}, but without knowing where you're flying from we can't tell if it's yours. Add your departure airport.`,
      closest.evidence,
    );
  const why = failed("privacy")
    ? "it's in an aircraft privacy programme"
    : failed("corridor")
      ? "it isn't along your route"
      : failed("heading")
        ? `it isn't heading for ${placeName(claim.arrival)}`
        : failed("route")
          ? `its public route record says ${closest.routeDescribed}`
          : failed("date")
            ? "it's the wrong day for your flight"
            : failed("fresh") || failed("airborne")
              ? "its position is too old to trust"
              : "the evidence isn't strong enough";
  return waiting(
    "weak-evidence",
    `An aircraft is broadcasting ${closest.candidate.callsign}, but ${why}. Passport won't put your name on it.`,
    closest.evidence,
  );
}
