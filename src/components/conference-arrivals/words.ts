import type {
  ArrivalRow,
  ArrivalsBoard,
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
