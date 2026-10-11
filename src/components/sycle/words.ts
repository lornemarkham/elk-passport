import type { BoardArrival } from "@/domain/sycle/board";
import type { Known } from "@/domain/sycle/flight";

/**
 * **What the board says, in words a tired traveller reads in one glance.**
 *
 * Every sentence that describes a flight says how it knows. "Lands 14:20" is
 * only ever followed by *est.* or *sched.* unless it already happened, and
 * nothing that has not been confirmed is worded as though it had.
 */
export const VANCOUVER_TZ = "America/Vancouver";

export function clock(iso: string, timeZone = VANCOUVER_TZ): string {
  return new Intl.DateTimeFormat("en-CA", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(new Date(iso));
}

export function dayOf(iso: string, timeZone = VANCOUVER_TZ): string {
  return new Intl.DateTimeFormat("en-CA", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone,
  }).format(new Date(iso));
}

/** "4h 12m", "23 min", "any minute now". Never negative. */
export function countdown(ms: number): string {
  if (ms <= 2 * 60_000) return "any minute now";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h ${String(mins).padStart(2, "0")}m`;
}

/** "ago" phrasing for "checked 12 min ago". */
export function ago(iso: string, now: Date): string {
  const minutes = Math.max(
    0,
    Math.round((now.getTime() - Date.parse(iso)) / 60_000),
  );
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours} h ago` : `${Math.round(hours / 24)} days ago`;
}

const MARK: Readonly<Record<Known["basis"], string>> = {
  verified: "",
  estimated: " est.",
  scheduled: " sched.",
};

/** "14:20 est." in Vancouver time, with the day when it is not today. */
export function landsAt(known: Known, now: Date): string {
  const sameDay = dayOf(known.at) === dayOf(now.toISOString());
  return `${sameDay ? "" : `${dayOf(known.at)} `}${clock(known.at)}${MARK[known.basis]}`;
}

/** The one line under a name. */
export function statusLine(a: BoardArrival, now: Date): string {
  switch (a.phase) {
    case "landed":
      return a.lands
        ? `Landed ${clock(a.lands.at)} — in Vancouver`
        : "Landed — in Vancouver";
    case "airborne": {
      const lands = a.lands
        ? `lands ${landsAt(a.lands, now)}`
        : "landing time not published";
      return `In the air · ${lands}`;
    }
    case "due-out":
      return "Should be on the way — not confirmed yet";
    case "cancelled":
      return "Cancelled. Hope the rebooking is kind.";
    case "diverted":
      return "Diverted — the airline is working out what next";
    case "scheduled":
      return a.departs
        ? `Leaves ${a.from.city} ${landsAt(a.departs, now)} (Vancouver time)`
        : `Leaving ${a.from.city}`;
  }
}

/** Delay, worded only when there is one worth mentioning. */
export function delayLine(a: BoardArrival): string | null {
  if (a.delayMinutes === null || a.phase === "cancelled") return null;
  if (a.delayMinutes >= 15) return `${countdown(a.delayMinutes * 60_000)} late`;
  if (a.delayMinutes <= -15)
    return `${countdown(-a.delayMinutes * 60_000)} early`;
  return null;
}

export const progressLabel = (fraction: number) =>
  `about ${Math.round(fraction * 100)}% of the way, by the clock`;
