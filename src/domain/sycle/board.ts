/**
 * **What one colleague is allowed to see about another.**
 *
 * The arrival board is a shared surface built out of personal travel, so the
 * privacy rules are not a settings page — they are this function. Everything
 * the server sends a browser about somebody else passes through
 * `boardFor`, and the tests pin what does and does not survive it:
 *
 * - **Nobody is on the board unless they put themselves there.** `off` is the
 *   default and an `off` participant does not exist to anyone but themselves —
 *   not as a dot, not in a count.
 * - **Anonymous hides the name, not the city.** The UI says so at the moment
 *   of choosing: if you are the only person flying in from Reykjavík, people
 *   may guess.
 * - **Nobody else ever receives a flight number.** Name + flight number + date
 *   is an itinerary; city + arrival time is enough to wave at someone in the
 *   lobby. You see your own in full.
 * - **The opaque `id`** is per participant record and is not the access
 *   cookie's identity, so a board payload cannot be replayed as somebody.
 * - **No position of a person, ever.** The board draws aeroplanes between
 *   airports; once landed, a person is "in Vancouver", not anywhere finer.
 */
import {
  arrivalDelayMinutes,
  bestTime,
  estimatedProgress,
  isVerified,
  phaseOf,
  routeKm,
  type FlightRecord,
  type Known,
  type Phase,
  type ReportedPosition,
} from "./flight";
import type { LatLon } from "./projection";

export type Visibility = "named" | "anonymous" | "off";

export interface Participant {
  /** Secret: the identity in the signed access cookie. Never sent to others. */
  readonly id: string;
  /** Public handle for this record on the board. Random, not derived. */
  readonly boardId: string;
  readonly displayName: string | null;
  readonly visibility: Visibility;
  readonly flight: {
    readonly flightNumber: string;
    readonly date: string;
  } | null;
  /** Atlas subject ids this person said "I'm in" to. */
  readonly adventures: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface BoardArrival {
  readonly id: string;
  readonly isYou: boolean;
  /** `null` for anonymous. */
  readonly name: string | null;
  /** Only on your own row. */
  readonly flightNumber: string | null;
  readonly from: {
    readonly city: string;
    readonly code: string | null;
    readonly location: LatLon | null;
  };
  readonly phase: Phase;
  readonly verified: boolean;
  readonly departs: Known | null;
  readonly lands: Known | null;
  readonly delayMinutes: number | null;
  readonly km: number | null;
  /** Estimated from published times. Labelled as such wherever drawn. */
  readonly estimated: {
    readonly fraction: number;
    readonly at: LatLon | null;
  } | null;
  /** Reported by the provider. `null` is the normal case. */
  readonly reported: ReportedPosition | null;
  /** When the provider was last asked. The board says "checked 12 min ago". */
  readonly checkedAt: string;
  readonly demo: boolean;
}

export interface Board {
  readonly arrivals: readonly BoardArrival[];
  /** Counts of *visible* participants only. Off is not counted. */
  readonly counts: {
    readonly onTheWay: number;
    readonly inVancouver: number;
    readonly cities: number;
  };
}

/** Clean a typed display name. Short, single-line, no markup worth keeping. */
export function readDisplayName(typed: unknown): string | null {
  if (typeof typed !== "string") return null;
  const clean = typed
    .replace(/[\u0000-\u001f<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return clean ? clean.slice(0, 40) : null;
}

const cityOf = (f: FlightRecord) =>
  f.departure.airport.city ?? f.departure.airport.name;

export function arrivalFor(
  p: Participant,
  flight: FlightRecord,
  now: Date,
  isYou: boolean,
): BoardArrival {
  const phase = phaseOf(flight, now);
  const progress = estimatedProgress(flight, now);
  return {
    id: p.boardId,
    isYou,
    name: p.visibility === "named" || isYou ? p.displayName : null,
    flightNumber: isYou ? flight.flightNumber : null,
    from: {
      city: cityOf(flight),
      code: flight.departure.airport.iata ?? flight.departure.airport.icao,
      location: flight.departure.airport.location,
    },
    phase,
    verified: isVerified(phase),
    departs: bestTime(flight.departure.times),
    lands: bestTime(flight.arrival.times),
    delayMinutes: arrivalDelayMinutes(flight),
    km: routeKm(flight),
    estimated: progress
      ? { fraction: progress.fraction, at: progress.at }
      : null,
    // A reported position is drawn only while airborne and only if fresh.
    reported:
      phase === "airborne" &&
      flight.position &&
      now.getTime() - Date.parse(flight.position.reportedAt) < 20 * 60_000
        ? flight.position
        : null,
    checkedAt: flight.fetchedAt,
    demo: flight.source === "demo",
  };
}

export function boardFor(
  participants: readonly Participant[],
  flights: ReadonlyMap<string, FlightRecord>,
  viewerId: string | null,
  now: Date,
): Board {
  const arrivals: BoardArrival[] = [];
  // Counts describe the shared board, so your own `off` row is not in them.
  const shared: BoardArrival[] = [];
  for (const p of participants) {
    const isYou = p.id === viewerId;
    if (p.visibility === "off" && !isYou) continue;
    if (!p.flight) continue;
    const flight = flights.get(flightKey(p.flight.flightNumber, p.flight.date));
    if (!flight) continue;
    const row = arrivalFor(p, flight, now, isYou);
    arrivals.push(row);
    if (p.visibility !== "off") shared.push(row);
  }
  arrivals.sort((a, b) => {
    const at = (x: BoardArrival) =>
      x.lands ? Date.parse(x.lands.at) : Infinity;
    return at(a) - at(b);
  });
  return {
    arrivals,
    counts: {
      onTheWay: shared.filter(
        (a) => a.phase !== "landed" && a.phase !== "cancelled",
      ).length,
      inVancouver: shared.filter((a) => a.phase === "landed").length,
      cities: new Set(shared.map((a) => a.from.code ?? a.from.city)).size,
    },
  };
}

export const flightKey = (flightNumber: string, date: string) =>
  `${flightNumber}|${date}`;

// ---------------------------------------------------------- shared adventures

export interface AdventureInterest {
  readonly adventureId: string;
  /** Names of people who chose to be named. Others are only counted. */
  readonly names: readonly string[];
  readonly count: number;
  readonly youreIn: boolean;
}

/**
 * Who's in, per Atlas subject. Interest uses the same visibility a person
 * chose for the board — one decision about how you appear, not two.
 */
export function interestFor(
  participants: readonly Participant[],
  viewerId: string | null,
): ReadonlyMap<string, AdventureInterest> {
  const out = new Map<
    string,
    { names: string[]; count: number; youreIn: boolean }
  >();
  for (const p of participants) {
    for (const id of p.adventures) {
      const row = out.get(id) ?? { names: [], count: 0, youreIn: false };
      row.count += 1;
      if (p.id === viewerId) row.youreIn = true;
      if ((p.visibility === "named" || p.id === viewerId) && p.displayName)
        row.names.push(p.id === viewerId ? "you" : p.displayName);
      out.set(id, row);
    }
  }
  return new Map(
    [...out].map(([adventureId, r]) => [adventureId, { adventureId, ...r }]),
  );
}

/** Your own record, minus the cookie identity — which never goes to a browser. */
export function ownRecord(
  p: Participant | null,
): Omit<Participant, "id"> | null {
  if (!p) return null;
  const { id: _secret, ...rest } = p;
  void _secret;
  return rest;
}
