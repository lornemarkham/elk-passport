import "server-only";
import type { AdsbSnapshot } from "@/domain/conference-arrivals/adsb";
import type { ArrivalRecord } from "@/domain/conference-arrivals/board";
import { candidatesFor } from "@/domain/conference-arrivals/flight";
import {
  decide,
  type Airport,
  type FlightClaim,
  type Search,
} from "@/domain/conference-arrivals/matching";
import { distanceKm } from "@/domain/conference-arrivals/geo";
import {
  afterFollow,
  afterSearch,
  AREA_KM,
  plan,
} from "@/domain/conference-arrivals/tracking";
import type { AdsbSource } from "./adsb-client";
import type { ArrivalsStore } from "./store";

/**
 * **Asks ADS-B about the flights that are due, and writes down what it said.**
 *
 * Runs when somebody reads the board, never on a timer, so a conference
 * nobody is looking at costs nothing. What is due is decided by
 * `tracking.plan` (searching once a minute, following an identified
 * aircraft every 10 s near the airport and every 30 s further out, nothing
 * before a flight's date or after it lands), and the ADS-B client's shared
 * cache means many viewers cost one lookup.
 *
 * ADSB.lol rate-limits hard, so the expensive part is shared: **one area
 * query around the conference's airport** answers for every flight whose
 * aircraft is within 250 nm of it. Only aircraft outside that circle cost a
 * call of their own.
 */

/** Only the aircraft in `area` broadcasting `callsign`, as a snapshot. */
const only = (
  area: AdsbSnapshot,
  keep: (a: AdsbSnapshot["aircraft"][number]) => boolean,
): AdsbSnapshot | null => {
  const aircraft = area.aircraft.filter(keep);
  return aircraft.length ? { at: area.at, aircraft } : null;
};

const inflight = new Map<string, Promise<void>>();

export const claimOf = (r: ArrivalRecord, arrival: Airport): FlightClaim => ({
  ident: r.flight.ident,
  date: r.flight.date,
  departure: r.flight.departure,
  arrival,
});

async function refreshOne(
  store: ArrivalsStore,
  source: AdsbSource,
  record: ArrivalRecord,
  arrival: Airport,
  now: Date,
  area: AdsbSnapshot | null,
): Promise<void> {
  const claim = claimOf(record, arrival);
  const { tracking, action } = plan(record.tracking, claim, now);
  let next = tracking;
  if (action === "search") {
    // Route records are free static files; live lookups are rate-limited.
    // An operator callsign only ever counts with a route record into this
    // airport, so without one it isn't worth a live call.
    const searches: Search[] = (
      await Promise.all(
        candidatesFor(claim.ident).map(async (candidate) => {
          const route = await source.route(candidate.callsign);
          const worthIt =
            candidate.kind === "direct" ||
            route?.airports.at(-1)?.icao === arrival.icao;
          if (!worthIt) return null;
          const nearby =
            area && only(area, (a) => a.callsign === candidate.callsign);
          const snapshot =
            nearby || (await source.byCallsign(candidate.callsign));
          return { candidate, snapshot, route };
        }),
      )
    ).filter((s): s is Search => s !== null);
    next = afterSearch(tracking, decide(claim, searches, now), now);
  } else if (action === "follow") {
    const hex = tracking.match!.hex;
    const nearby = area && only(area, (a) => a.hex === hex);
    next = afterFollow(
      tracking,
      nearby || (await source.byHex(hex)),
      arrival,
      now,
    );
  }
  if (next === record.tracking) return;
  // The person may have changed or removed their flight while we asked.
  const current = await store.get(record.conferenceId, record.memberId);
  if (!current || current.updatedAt !== record.updatedAt) return;
  await store.put({ ...current, tracking: next });
}

/**
 * Refresh every due flight in a conference, waiting at most `budgetMs` so a
 * slow feed can't hold the page. Whatever finishes later is still written
 * down and shows on the next poll.
 */
export async function refreshDue(
  store: ArrivalsStore,
  source: AdsbSource,
  records: readonly ArrivalRecord[],
  arrival: Airport,
  now: Date,
  budgetMs = 4_000,
): Promise<void> {
  const due = records.filter(
    (r) => plan(r.tracking, claimOf(r, arrival), now).action !== "none",
  );
  if (!due.length) return;
  // The area query only helps a search, or an aircraft already near the
  // airport. Following one over the Rockies, it would be a wasted call.
  const areaHelps = due.some(
    (r) =>
      !r.tracking.match ||
      !r.tracking.last ||
      distanceKm(r.tracking.last, arrival) <= AREA_KM,
  );
  const area = areaHelps ? await source.around(arrival.lat, arrival.lon) : null;
  const work = due.map((r) => {
    const key = `${r.conferenceId}:${r.memberId}`;
    let p = inflight.get(key);
    if (!p) {
      p = refreshOne(store, source, r, arrival, now, area)
        .catch((error) => console.error("[arrivals] refresh failed", error))
        .finally(() => inflight.delete(key));
      inflight.set(key, p);
    }
    return p;
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    Promise.all(work),
    new Promise<void>((r) => (timer = setTimeout(r, budgetMs))),
  ]);
  clearTimeout(timer);
}
