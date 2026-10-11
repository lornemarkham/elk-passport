/**
 * **When a flight is worth asking about again.**
 *
 * One cached record per flight and date, shared by every viewer; a viewer
 * never causes a provider call, only a stale record does. So the bill is a
 * function of how many flights there are, not how many times 160 excited
 * people reload the board. Measured against AeroDataBox's pricing for ~210
 * legs this is roughly 12–15k calls for the whole event (see
 * `docs/sycle/flight-data.md`).
 *
 *   > 24 h before departure     every 24 h
 *   24 h – 4 h                  every 2 h
 *   last 4 h, and late          every 15 min
 *   airborne                    every 30 min (times barely move mid-ocean)
 *   within 1 h of landing       every 10 min
 *   landed / cancelled          never again
 *
 * Diverted keeps refreshing hourly: a diversion is the one terminal status
 * that usually gets a second chapter.
 */
import { bestTime, phaseOf, type FlightRecord } from "./flight";

const MIN = 60_000;
const HOUR = 60 * MIN;

export function refreshAfterMs(flight: FlightRecord, now: Date): number | null {
  const phase = phaseOf(flight, now);
  if (phase === "landed" || phase === "cancelled") return null;
  if (phase === "diverted") return HOUR;

  const t = now.getTime();
  if (phase === "airborne") {
    const lands = bestTime(flight.arrival.times);
    if (lands && Date.parse(lands.at) - t < HOUR) return 10 * MIN;
    return 30 * MIN;
  }

  const out = bestTime(flight.departure.times);
  if (!out) return 24 * HOUR;
  const until = Date.parse(out.at) - t;
  if (until > 24 * HOUR) return 24 * HOUR;
  if (until > 4 * HOUR) return 2 * HOUR;
  return 15 * MIN;
}

export function isStale(flight: FlightRecord, now: Date): boolean {
  const after = refreshAfterMs(flight, now);
  if (after === null) return false;
  return now.getTime() - Date.parse(flight.fetchedAt) >= after;
}
