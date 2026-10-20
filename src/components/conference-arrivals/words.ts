import {
  arrivalTime,
  type ArrivalRow,
  type ArrivalsBoard,
} from "@/domain/conference-arrivals/board";
import { distanceKm } from "@/domain/conference-arrivals/geo";
import type { ConferenceKind } from "@/domain/conference/types";

/**
 * **What the board says.** A party favour, not an operations console — but
 * every sentence about a flight is still true. Nothing says "in the air"
 * unless ADS-B showed it in the air, a stale position always says how old it
 * is, and an inferred landing says it's inferred.
 */

const CROWD: Readonly<Record<ConferenceKind, string>> = {
  conference: "coworkers",
  retreat: "people",
  wedding: "guests",
  reunion: "people",
  festival: "people",
  trip: "people",
};

const NUMBER = [
  "Zero",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
];
const count = (n: number) => NUMBER[n] ?? String(n);

const who = (r: ArrivalRow) => (r.isYou ? "You" : (r.name ?? "Someone"));
const is = (r: ArrivalRow) => (r.isYou ? "are" : "is");
const has = (r: ArrivalRow) => (r.isYou ? "have" : "has");

export const APPROACHING_KM = 150;

export interface Headline {
  readonly big: string;
  readonly small: string;
}

export function headline(
  board: ArrivalsBoard,
  place: string,
  kind: ConferenceKind,
  now: Date,
): Headline {
  const rows = board.rows;
  const airborne = rows.filter((r) => r.phase === "airborne");
  const close = airborne
    .filter(
      (r) =>
        r.position && distanceKm(r.position, board.arrival) <= APPROACHING_KM,
    )
    .sort(
      (a, b) =>
        distanceKm(a.position!, board.arrival) -
        distanceKm(b.position!, board.arrival),
    );
  const justLanded = rows
    .filter(
      (r) =>
        r.phase === "landed" &&
        r.landedAt &&
        now.getTime() - Date.parse(r.landedAt) < 45 * 60_000,
    )
    .sort((a, b) => Date.parse(b.landedAt!) - Date.parse(a.landedAt!));
  const landed = rows.filter((r) => r.phase === "landed");
  const crowd = CROWD[kind];

  if (justLanded[0]) {
    const r = justLanded[0];
    return {
      big: `${who(r)} ${has(r)} landed.`,
      small:
        r.landedBasis === "inferred"
          ? `Signal ended on short final, so we're calling it. ${place} has been notified.`
          : `${place} has been notified.`,
    };
  }
  if (close[0]) {
    const r = close[0];
    return {
      big: `${who(r)} ${is(r)} approaching ${place}.`,
      small: "This is not a drill.",
    };
  }
  if (airborne.length >= 2)
    return {
      big: `${count(airborne.length)} ${crowd} airborne.`,
      small: "Productivity has left the building.",
    };
  if (airborne.length === 1)
    return {
      big: "THE INVASION HAS BEGUN.",
      small: `${who(airborne[0]!)} ${is(airborne[0]!)} in the air.`,
    };
  if (rows.some((r) => r.phase === "lost"))
    return {
      big: "Somebody's gone quiet.",
      small:
        "Out of range of the ground receivers. Their last known position is on the map.",
    };
  if (landed.length)
    return {
      big: `${count(landed.length)} down.`,
      small: `${place} is holding up well.`,
    };
  if (rows.some((r) => r.phase === "searching"))
    return {
      big: "Bags are packed.",
      small: "Waiting for the first aircraft to show up on ADS-B.",
    };
  return {
    big: "The invasion is being planned.",
    small: rows.length
      ? "Nobody's in the air yet."
      : "Add your flight and you're the first plane on the map.",
  };
}

/** "just now", "40 s ago", "12 min ago", "3 h ago". */
export function ago(iso: string, now: Date): string {
  const s = Math.max(0, Math.round((now.getTime() - Date.parse(iso)) / 1000));
  if (s < 5) return "just now";
  if (s < 90) return `${s} s ago`;
  const m = Math.round(s / 60);
  if (m < 90) return `${m} min ago`;
  return `${Math.round(m / 60)} h ago`;
}

export function clock(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(new Date(iso));
}

export function day(date: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

const cityOf = (a: { city: string | null; name: string } | null) =>
  a ? (a.city ?? a.name) : null;

/** The one line under a name in the list. */
export function statusLine(r: ArrivalRow, now: Date, timeZone: string): string {
  const from = cityOf(r.from);
  switch (r.phase) {
    case "airborne":
      return `In the air${from ? ` from ${from}` : ""} · live ${r.position ? ago(r.position.at, now) : ""}`;
    case "lost":
      return `Signal lost · last seen ${r.position ? ago(r.position.at, now) : "a while ago"}`;
    case "landed":
      return r.landedBasis === "inferred"
        ? `Landed, by the look of it · signal ended on short final at ${clock(r.landedAt!, timeZone)}`
        : `Landed ${clock(r.landedAt!, timeZone)} · in ${cityOf(r.to)}`;
    case "searching":
      return r.isYou
        ? "Waiting to identify your aircraft."
        : `Waiting to identify ${r.name ?? "someone"}'s aircraft.`;
    case "missed":
      return "Never identified. Hope the flight was kind.";
    case "scheduled":
      return `${day(r.date)}${from ? ` · ${from} → ${r.to.iata ?? r.to.icao}` : ""} · not flying yet`;
  }
}

/** An instant as a wall time where the conference is: `YYYY-MM-DDTHH:mm`. */
export function localWall(iso: string, timeZone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone,
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export type TimeKind = "landed" | "estimated" | "scheduled" | "leaves";

export interface TimeCell {
  /** `14:20`, `~14:35`, or a day when there's no time. */
  readonly time: string;
  readonly kind: TimeKind;
  /** The small word under it. Says what kind of claim the time is. */
  readonly tag: string;
  /** The whole claim, for screen readers and the details panel. */
  readonly says: string;
}

/**
 * The arrivals board's left column. Every time carries its kind: an observed
 * landing, an estimate from a live aircraft, or the person's own booking.
 * With none of those, the day it leaves, said as such.
 */
export function timeCell(r: ArrivalRow, timeZone: string): TimeCell {
  const t = arrivalTime(r);
  if (t?.kind === "landed") {
    const at = clock(t.at, timeZone);
    return {
      time: at,
      kind: "landed",
      tag: t.inferred ? "Landed?" : "Landed",
      says: t.inferred
        ? `Signal ended on short final at ${at}`
        : `Landed at ${at}`,
    };
  }
  if (t?.kind === "estimated") {
    const at = clock(t.at, timeZone);
    return {
      time: `~${at}`,
      kind: "estimated",
      tag: "Estimate",
      says: `Estimated ${at}, at its current speed, straight in`,
    };
  }
  if (t?.kind === "scheduled") {
    const at = t.local.slice(11, 16);
    return {
      time: at,
      kind: "scheduled",
      tag: "Scheduled",
      says: `Scheduled ${day(t.local.slice(0, 10))} ${at}, from ${r.isYou ? "your" : "their"} booking`,
    };
  }
  return {
    time: day(r.date).replace(/^\w+, /, ""),
    kind: "leaves",
    tag: "Leaves",
    says: `Leaves ${day(r.date)}`,
  };
}

/**
 * The estimate against the booking, when both exist and differ by 10 minutes
 * or more: "About 25 min behind schedule." An estimate, said as one. Not at
 * all when they are more than six hours apart.
 */
export function versusSchedule(r: ArrivalRow, timeZone: string): string | null {
  const t = arrivalTime(r);
  if (t?.kind !== "estimated" || !r.lands) return null;
  const minutes = Math.round(
    (Date.parse(`${localWall(t.at, timeZone)}Z`) - Date.parse(`${r.lands}Z`)) /
      60_000,
  );
  // Hours apart is not a delay; it's a booking for another day or another
  // leg. Say nothing rather than something silly.
  if (Math.abs(minutes) > 6 * 60) return null;
  if (Math.abs(minutes) < 10) return "About on schedule, by the estimate.";
  return `About ${Math.abs(minutes)} min ${minutes > 0 ? "behind" : "ahead of"} schedule, by the estimate.`;
}
