/**
 * **One flight's story, as ADS-B told it.**
 *
 * ```
 * scheduled   the date hasn't come; nothing is asked of ADS-B
 * searching   looking for an aircraft that matches (matching.ts)
 * airborne    identified, and its position is current
 * lost        identified, then the signal went quiet. The last real
 *             position stays, labelled with its age. Nothing extrapolates it
 * landed      seen on the ground at the conference's airport, or (typed
 *             `inferred`) its signal ended on short final: at or below
 *             1,000 ft within 8 km of it. ADS-B receivers rarely hear an
 *             aircraft once it's on the ground at YVR — recorded on
 *             2026-10-12, UAL1580's last report was 275 ft, 3 km out
 * missed      the flight's window closed and nothing ever matched
 * ```
 *
 * Every position stored here is one an aircraft broadcast. Nothing in this
 * file computes a position, and the board draws only what is here.
 *
 * Pure: the I/O lives in `src/lib/conference-arrivals/tracker.ts`.
 */
import type { AdsbSnapshot } from "./adsb";
import type { CallsignCandidate } from "./flight";
import { distanceKm } from "./geo";
import {
  flightWindow,
  FRESH_SECONDS,
  type Airport,
  type Decision,
  type Evidence,
  type FlightClaim,
  type Leg,
  type WaitReason,
} from "./matching";

export interface Fix {
  readonly lat: number;
  readonly lon: number;
  readonly altitudeFt: number | null;
  readonly groundSpeedKt: number | null;
  readonly trackDeg: number | null;
  readonly onGround: boolean;
  /** When the aircraft broadcast this position. */
  readonly at: string;
}

export interface Identified {
  readonly hex: string;
  readonly callsign: string;
  readonly operator: CallsignCandidate["operator"];
  readonly registration: string | null;
  readonly type: string | null;
  readonly identifiedAt: string;
  readonly leg: Leg;
  /** The checks that passed when it was identified. Shown on tap. */
  readonly evidence: readonly Evidence[];
}

export type TrackPhase =
  "scheduled" | "searching" | "airborne" | "lost" | "landed" | "missed";

export interface Tracking {
  readonly phase: TrackPhase;
  readonly match: Identified | null;
  /** The most recent real position. Kept when the signal is lost. */
  readonly last: Fix | null;
  /** Recent real positions, oldest first, for the line behind the plane. */
  readonly trail: readonly Fix[];
  /** Why we're still waiting, while `searching`. */
  readonly waiting: {
    readonly reason: WaitReason;
    readonly says: string;
    readonly evidence: readonly Evidence[];
  } | null;
  /** Why the signal is `lost`, in words. */
  readonly lostBecause: string | null;
  /** When ADS-B was last asked about this flight. */
  readonly checkedAt: string | null;
  readonly landedAt: string | null;
  /** `ground`: reported on the ground there. `inferred`: lost on short final. */
  readonly landedBasis: "ground" | "inferred" | null;
}

export const NOT_STARTED: Tracking = {
  phase: "scheduled",
  match: null,
  last: null,
  trail: [],
  waiting: null,
  lostBecause: null,
  checkedAt: null,
  landedAt: null,
  landedBasis: null,
};

const TRAIL_MAX = 240;
/** On the ground this close to the conference's airport is landed. */
export const LANDED_KM = 10;
/** Last heard this low and this close, then silence: landed (inferred). */
export const SHORT_FINAL_FT = 1_000;
export const SHORT_FINAL_KM = 8;
/** Quiet for this long, an identified aircraft is `lost`. */
export const LOST_AFTER_SECONDS = 120;

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

/** How often each phase is worth a call to ADS-B. `null`: never again. */
export const CADENCE: Readonly<Record<TrackPhase, number | null>> = {
  scheduled: null,
  searching: 60 * SECOND,
  airborne: 10 * SECOND,
  lost: 60 * SECOND,
  landed: null,
  missed: null,
};

/**
 * What to do now: nothing, search by callsign, or follow the identified
 * aircraft by its transponder address. Also moves `scheduled` → `searching`
 * when the window opens, and gives up after it closes.
 */
export function plan(
  t: Tracking,
  claim: FlightClaim,
  now: Date,
): { tracking: Tracking; action: "none" | "search" | "follow" } {
  const window = flightWindow(claim.date, claim.departure, claim.arrival);
  const ms = now.getTime();
  if (t.phase === "landed" || t.phase === "missed")
    return { tracking: t, action: "none" };

  if (!t.match) {
    if (ms < window.opens.getTime())
      return { tracking: { ...t, phase: "scheduled" }, action: "none" };
    if (ms > window.closes.getTime())
      return {
        tracking: {
          ...t,
          phase: "missed",
          waiting: {
            reason: "too-late",
            says: `A flight dated ${claim.date} should be on the ground by now. ADS-B never showed us one we could be sure was yours.`,
            evidence: t.waiting?.evidence ?? [],
          },
        },
        action: "none",
      };
    const searching: Tracking = { ...t, phase: "searching" };
    return {
      tracking: searching,
      action: due(searching, ms, claim.arrival) ? "search" : "none",
    };
  }

  // Identified. Stop following a lost aircraft well after it should have landed.
  if (t.phase === "lost" && ms > window.closes.getTime() + 3 * HOUR)
    return { tracking: t, action: "none" };
  return { tracking: t, action: due(t, ms, claim.arrival) ? "follow" : "none" };
}

/** Within this of the airport, the shared area query sees the aircraft. */
export const AREA_KM = 450;

function due(t: Tracking, ms: number, arrival: Airport): boolean {
  let every = CADENCE[t.phase];
  // Further out each follow is a call of its own, so it's made less often.
  if (
    every !== null &&
    t.phase === "airborne" &&
    t.last &&
    distanceKm(t.last, arrival) > AREA_KM
  )
    every = 30 * SECOND;
  if (every === null) return false;
  return !t.checkedAt || ms - Date.parse(t.checkedAt) >= every;
}

function fixOf(o: AdsbSnapshot["aircraft"][number]): Fix | null {
  if (!o.position || !o.positionAt) return null;
  return {
    lat: o.position.lat,
    lon: o.position.lon,
    altitudeFt: o.altitudeFt,
    groundSpeedKt: o.groundSpeedKt,
    trackDeg: o.trackDeg,
    onGround: o.onGround,
    at: o.positionAt,
  };
}

function withFix(t: Tracking, fix: Fix): Pick<Tracking, "last" | "trail"> {
  if (t.last && t.last.at === fix.at) return { last: t.last, trail: t.trail };
  return { last: fix, trail: [...t.trail, fix].slice(-TRAIL_MAX) };
}

/** After a search: identified, or still waiting and why. */
export function afterSearch(t: Tracking, d: Decision, now: Date): Tracking {
  const checkedAt = now.toISOString();
  if (d.kind === "waiting")
    return {
      ...t,
      phase: "searching",
      checkedAt,
      waiting: { reason: d.reason, says: d.says, evidence: d.evidence },
    };
  const fix = fixOf(d.aircraft);
  return {
    ...t,
    ...(fix ? withFix(t, fix) : {}),
    phase: "airborne",
    checkedAt,
    waiting: null,
    lostBecause: null,
    match: {
      hex: d.aircraft.hex,
      callsign: d.candidate.callsign,
      operator: d.candidate.operator,
      registration: d.aircraft.registration,
      type: d.aircraft.type,
      identifiedAt: checkedAt,
      leg: d.leg,
      evidence: d.evidence,
    },
  };
}

/**
 * After following the identified aircraft by its address. `snapshot: null`
 * is a failed request: nothing about the aircraft changes, least of all its
 * position.
 */
export function afterFollow(
  t: Tracking,
  snapshot: AdsbSnapshot | null,
  arrival: Airport,
  now: Date,
): Tracking {
  if (!t.match || !snapshot) return t;
  const checkedAt = now.toISOString();
  const lost = (because: string, base: Tracking = t): Tracking => {
    const last = base.last;
    if (
      last &&
      last.altitudeFt !== null &&
      last.altitudeFt <= SHORT_FINAL_FT &&
      distanceKm(last, arrival) <= SHORT_FINAL_KM
    )
      return {
        ...base,
        phase: "landed",
        checkedAt,
        landedAt: last.at,
        landedBasis: "inferred",
        lostBecause: null,
      };
    return { ...base, phase: "lost", checkedAt, lostBecause: because };
  };

  const seen = snapshot.aircraft.find((a) => a.hex === t.match!.hex);
  if (!seen) return lost("Out of range of ADS-B receivers.");
  if (seen.callsign && seen.callsign !== t.match.callsign)
    return lost(
      `The aircraft is now broadcasting ${seen.callsign}, so it's flying something else.`,
    );
  const fix = fixOf(seen);
  if (!fix) return lost("Heard, but without a position.");
  const ageS = (Date.parse(snapshot.at) - Date.parse(fix.at)) / 1000;
  const next = { ...t, ...withFix(t, fix), checkedAt };
  if (ageS > Math.max(LOST_AFTER_SECONDS, FRESH_SECONDS))
    return lost("Its signal has gone quiet.", next);
  if (fix.onGround) {
    if (distanceKm(fix, arrival) <= LANDED_KM)
      return {
        ...next,
        phase: "landed",
        landedAt: fix.at,
        landedBasis: "ground",
        lostBecause: null,
      };
    return {
      ...next,
      phase: "lost",
      lostBecause: `On the ground ${Math.round(distanceKm(fix, arrival))} km from ${arrival.iata ?? arrival.icao}.`,
    };
  }
  return { ...next, phase: "airborne", lostBecause: null };
}
