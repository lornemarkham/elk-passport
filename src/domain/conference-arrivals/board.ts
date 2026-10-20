/**
 * **What one member of a conference may see about another's flight.**
 *
 * Everything the server sends a browser about somebody else's travel passes
 * through `boardFor`, and the tests pin what survives it:
 *
 * - **Sharing is opt-in.** A flight is on other people's board only when its
 *   owner chose to share it *and* chose to be seen in the conference under a
 *   name (the foundation's `members` visibility). Either one missing, and it
 *   does not exist to anybody else: not as a plane, not in a count.
 * - **Shared means shared.** Name, flight number, route, the aircraft's
 *   registration and its live position. That is what "share my flight" says
 *   on the form, in those words.
 * - **Only members.** Callers reach this through the conference foundation's
 *   membership check; a stranger never gets this far (`service.ts`).
 * - **A person is never located.** The board draws aircraft. Once landed, a
 *   person is "in Vancouver", not anywhere finer.
 *
 * And every arrival time says what kind of claim it is (`arrivalTime`):
 * observed, estimated from an observation, or stated by the person.
 */
import type { FlightIdent } from "./flight";
import { distanceKm } from "./geo";
import type { Airport, Evidence, Leg } from "./matching";
import {
  LOST_AFTER_SECONDS,
  type Fix,
  type Identified,
  type TrackPhase,
  type Tracking,
} from "./tracking";

export interface ArrivalRecord {
  readonly conferenceId: string;
  readonly memberId: string;
  readonly flight: {
    readonly ident: FlightIdent;
    readonly date: string;
    /** As the person stated it. `null`: they didn't. */
    readonly departure: Airport | null;
    /**
     * When their booking says it lands, `YYYY-MM-DDTHH:mm` at the conference's
     * airport, as they typed it. Optional, and absent on records saved before
     * it was asked. Never used to place an aircraft.
     */
    readonly lands?: string | null;
  };
  readonly shared: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly tracking: Tracking;
}

export interface ArrivalRow {
  readonly memberId: string;
  readonly isYou: boolean;
  /** The name this person chose in the conference; `null` only on your own row. */
  readonly name: string | null;
  readonly flight: string;
  readonly airline: string | null;
  readonly date: string;
  /** Scheduled landing, local wall time at `to`, as the person stated it. */
  readonly lands: string | null;
  readonly from: Airport | null;
  readonly fromBasis: Leg["fromBasis"] | null;
  readonly to: Airport;
  readonly phase: TrackPhase;
  readonly aircraft: Pick<
    Identified,
    "callsign" | "registration" | "type" | "operator" | "identifiedAt"
  > | null;
  /** The last real position. While `lost`, it is stale and labelled so. */
  readonly position: Fix | null;
  /** Real positions, `[lon, lat]`, for the line behind the plane. */
  readonly trail: readonly (readonly [number, number])[];
  readonly lostBecause: string | null;
  readonly landedAt: string | null;
  readonly landedBasis: Tracking["landedBasis"];
  readonly checkedAt: string | null;
  /** While searching or missed: the sentence under "Waiting to identify…". */
  readonly waiting: string | null;
  /** Why it was identified, or why it wasn't yet. */
  readonly evidence: readonly Evidence[];
  /** Your own row only: whether you're sharing it. */
  readonly shared: boolean | null;
}

export interface ArrivalsBoard {
  readonly arrival: Airport;
  readonly rows: readonly ArrivalRow[];
  /** Shared rows only. Your own unshared flight is not "the conference". */
  readonly counts: {
    readonly airborne: number;
    readonly landed: number;
    readonly waiting: number;
    readonly total: number;
  };
}

const ORDER: Readonly<Record<TrackPhase, number>> = {
  airborne: 0,
  lost: 1,
  searching: 2,
  scheduled: 3,
  landed: 4,
  missed: 5,
};

export function rowFor(
  r: ArrivalRecord,
  arrival: Airport,
  name: string | null,
  isYou: boolean,
): ArrivalRow {
  const t = r.tracking;
  const leg = t.match?.leg ?? null;
  return {
    memberId: r.memberId,
    isYou,
    name,
    flight: r.flight.ident.display,
    airline: r.flight.ident.airlineName,
    date: r.flight.date,
    lands: r.flight.lands ?? null,
    from: leg?.from ?? r.flight.departure,
    fromBasis: leg?.fromBasis ?? (r.flight.departure ? "stated" : null),
    to: arrival,
    phase: t.phase,
    aircraft: t.match
      ? {
          callsign: t.match.callsign,
          registration: t.match.registration,
          type: t.match.type,
          operator: t.match.operator,
          identifiedAt: t.match.identifiedAt,
        }
      : null,
    position: t.match ? t.last : null,
    trail: t.match ? t.trail.map((f) => [f.lon, f.lat] as const) : [],
    lostBecause: t.phase === "lost" ? t.lostBecause : null,
    landedAt: t.landedAt,
    landedBasis: t.landedBasis,
    checkedAt: t.checkedAt,
    waiting:
      t.phase === "searching" || t.phase === "missed"
        ? (t.waiting?.says ?? "Looking for your aircraft.")
        : null,
    evidence: t.match?.evidence ?? t.waiting?.evidence ?? [],
    shared: isYou ? r.shared : null,
  };
}

/**
 * "Live" is a claim about now, so it is decided now. An airborne row whose
 * last report is older than `LOST_AFTER_SECONDS` is shown as lost, whatever
 * the reason: out of range, or ADSB.lol rate-limiting us so nobody asked.
 */
export function asOf(row: ArrivalRow, now: Date): ArrivalRow {
  if (row.phase !== "airborne" || !row.position) return row;
  const age = (now.getTime() - Date.parse(row.position.at)) / 1000;
  if (age <= LOST_AFTER_SECONDS) return row;
  return {
    ...row,
    phase: "lost",
    lostBecause: "No fresh report from ADS-B.",
  };
}

/** By landing time where one was given; untimed flights last on their day. */
const whenKey = (r: ArrivalRow) => r.lands ?? `${r.date}T99:99`;
const byWhen = (a: ArrivalRow, b: ArrivalRow) => {
  const x = whenKey(a);
  const y = whenKey(b);
  return x < y ? -1 : x > y ? 1 : 0;
};

/**
 * @param named  memberId → display name, for members who chose to be seen.
 *               Exactly the foundation's `MemberHome.people.visible`.
 */
export function boardFor(
  records: readonly ArrivalRecord[],
  arrival: Airport,
  viewer: {
    readonly memberId: string;
    readonly displayName: string | null;
    /** Chose `members` visibility in the conference. */
    readonly seen: boolean;
  },
  named: ReadonlyMap<string, string>,
  now: Date,
): ArrivalsBoard {
  const rows: ArrivalRow[] = [];
  const shared: ArrivalRow[] = [];
  for (const r of records) {
    const isYou = r.memberId === viewer.memberId;
    const name = isYou ? viewer.displayName : (named.get(r.memberId) ?? null);
    const visibleToOthers =
      r.shared && (isYou ? viewer.seen && !!name : name !== null);
    if (!isYou && !visibleToOthers) continue;
    const row = asOf(rowFor(r, arrival, name, isYou), now);
    rows.push(row);
    if (visibleToOthers) shared.push(row);
  }
  rows.sort(
    (a, b) =>
      ORDER[a.phase] - ORDER[b.phase] ||
      byWhen(a, b) ||
      (a.name ?? "").localeCompare(b.name ?? ""),
  );
  return {
    arrival,
    rows,
    counts: {
      airborne: shared.filter((r) => r.phase === "airborne").length,
      landed: shared.filter((r) => r.phase === "landed").length,
      waiting: shared.filter((r) => r.phase === "searching").length,
      total: shared.length,
    },
  };
}

/** Below this, ground speed says more about the approach than the trip. */
export const ESTIMATE_MIN_KT = 100;

/**
 * **When someone gets in, and what kind of claim that is.** The board never
 * shows a time without its kind, because they are different things
 * (doctrine §5: signals, inference and stated facts stay distinguishable):
 *
 * - `landed`: ADS-B saw it land, or (`inferred`) its signal ended on short
 *   final. An instant.
 * - `estimated`: a live, identified aircraft's distance to the airport at its
 *   current ground speed, straight in, from its last real report. An instant,
 *   and an inference: holding patterns and the slowdown on approach make the
 *   real landing later. Only for a fresh `airborne` row (run `asOf` first).
 * - `scheduled`: what the person's booking says, as they typed it. A local
 *   wall time at the airport, not checked against any airline.
 *
 * Lost, searching and missed flights get only their scheduled time, if any:
 * a stale position estimates nothing.
 */
export type ArrivalTime =
  | { readonly kind: "landed"; readonly at: string; readonly inferred: boolean }
  | { readonly kind: "estimated"; readonly at: string }
  | { readonly kind: "scheduled"; readonly local: string };

export function arrivalTime(row: ArrivalRow): ArrivalTime | null {
  if (row.phase === "landed" && row.landedAt)
    return {
      kind: "landed",
      at: row.landedAt,
      inferred: row.landedBasis === "inferred",
    };
  const p = row.position;
  if (
    row.phase === "airborne" &&
    p &&
    !p.onGround &&
    p.groundSpeedKt !== null &&
    p.groundSpeedKt >= ESTIMATE_MIN_KT
  ) {
    const hours = distanceKm(p, row.to) / (p.groundSpeedKt * 1.852);
    return {
      kind: "estimated",
      at: new Date(Date.parse(p.at) + hours * 3_600_000).toISOString(),
    };
  }
  return row.lands ? { kind: "scheduled", local: row.lands } : null;
}
