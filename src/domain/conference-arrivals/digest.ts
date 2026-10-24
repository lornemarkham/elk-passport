import { zonedToUtc } from "@/domain/conference-plans/time";
import { arrivalTime, type ArrivalRow, type ArrivalsBoard } from "./board";

/**
 * **The board, read as a person asks it: who's here, who's next, when does
 * everyone land, and who should share a ride.**
 *
 * Built from the board's own rows and the board's own three kinds of time
 * (`arrivalTime`: landed, estimated, scheduled), so it never says more than
 * the board does: a time from a booking stays "scheduled", an estimate stays
 * "~", and a flight with only a departure date is on its day with no time.
 */

export type DigestKind = "landed" | "estimated" | "scheduled" | "unknown";

export interface DigestEntry {
  readonly memberId: string;
  readonly name: string;
  readonly you: boolean;
  readonly flight: string;
  /** UTC instant, or `null` when only the day is known. */
  readonly at: string | null;
  /** `YYYY-MM-DD` in the conference's zone. */
  readonly day: string;
  readonly kind: DigestKind;
  readonly inferred: boolean;
}

export interface LandingTogether {
  readonly day: string;
  /** The earliest and latest arrival in the group, UTC. */
  readonly from: string;
  readonly to: string;
  readonly people: readonly DigestEntry[];
}

export interface ArrivalsDigest {
  readonly landed: readonly DigestEntry[];
  /** The soonest arrival still to come, if any has a time. */
  readonly next: DigestEntry | null;
  readonly timeline: readonly {
    day: string;
    entries: readonly DigestEntry[];
  }[];
  readonly together: readonly LandingTogether[];
  readonly airport: string;
}

/** Two people landing this close together can wait for each other. */
export const TOGETHER_MS = 45 * 60_000;

const dayOf = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));

export function entryOf(row: ArrivalRow, timeZone: string): DigestEntry {
  const t = arrivalTime(row);
  const base = {
    memberId: row.memberId,
    name: row.isYou ? "You" : (row.name ?? "A coworker"),
    you: row.isYou,
    flight: row.flight,
  };
  if (t?.kind === "landed" || t?.kind === "estimated")
    return {
      ...base,
      at: t.at,
      day: dayOf(t.at, timeZone),
      kind: t.kind,
      inferred: t.kind === "landed" && t.inferred,
    };
  if (t?.kind === "scheduled") {
    const at = zonedToUtc(
      t.local.slice(0, 10),
      t.local.slice(11, 16),
      timeZone,
    );
    if (at)
      return {
        ...base,
        at: at.toISOString(),
        day: t.local.slice(0, 10),
        kind: "scheduled",
        inferred: false,
      };
  }
  return { ...base, at: null, day: row.date, kind: "unknown", inferred: false };
}

export function digest(
  board: ArrivalsBoard,
  now: Date,
  timeZone: string,
): ArrivalsDigest {
  const entries = board.rows
    // Your own unshared flight is yours, not the group's board.
    .filter((r) => !r.isYou || r.shared !== false)
    .filter((r) => r.phase !== "missed")
    .map((r) => entryOf(r, timeZone));
  const landed = entries
    .filter((e) => e.kind === "landed")
    .sort((a, b) => b.at!.localeCompare(a.at!));
  const coming = entries
    .filter(
      (e) =>
        e.kind !== "landed" &&
        e.at &&
        Date.parse(e.at) >= now.getTime() - 15 * 60_000,
    )
    .sort((a, b) => a.at!.localeCompare(b.at!));
  const byDay = new Map<string, DigestEntry[]>();
  for (const e of entries) byDay.set(e.day, [...(byDay.get(e.day) ?? []), e]);
  const timeline = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, list]) => ({
      day,
      entries: list.sort(
        (a, b) =>
          (a.at ? Date.parse(a.at) : Infinity) -
          (b.at ? Date.parse(b.at) : Infinity),
      ),
    }));

  // Landing together: still to land (or landed in the last half hour), with a
  // time, and within 45 minutes of the previous person in the group.
  const pool = entries
    .filter(
      (e) =>
        e.at &&
        (e.kind !== "landed" || now.getTime() - Date.parse(e.at) < 30 * 60_000),
    )
    .sort((a, b) => a.at!.localeCompare(b.at!));
  const together: LandingTogether[] = [];
  let group: DigestEntry[] = [];
  const flush = () => {
    if (group.length >= 2)
      together.push({
        day: group[0]!.day,
        from: group[0]!.at!,
        to: group[group.length - 1]!.at!,
        people: group,
      });
    group = [];
  };
  for (const e of pool) {
    const last = group[group.length - 1];
    if (last && Date.parse(e.at!) - Date.parse(last.at!) > TOGETHER_MS) flush();
    group.push(e);
  }
  flush();

  return {
    landed,
    next: coming[0] ?? null,
    timeline,
    together,
    airport: board.arrival.iata ?? board.arrival.icao,
  };
}
