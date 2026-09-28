import { localDay } from "@/domain/experience/eventTime";

/**
 * **The October the surface is about, and when it reads from.**
 *
 * Two facts the October pages kept deriving inline, and one of them wrongly.
 *
 * ## The month
 *
 * `2026-10-01` to `2026-10-31`, taken from the year the viewer is in. The
 * Discover page built those two strings from `today.slice(0, 4)` in three
 * places; this is the same rule, named once.
 *
 * ## The instant the near lanes read from
 *
 * Tonight, This weekend and Coming up all ask "what is on *now*", and before
 * October begins the honest answer for an October surface is not "the last
 * Sunday in September". Opened on 2026-09-27 the page led Tonight with three
 * Culture Days events and left This weekend empty — a September answer on a
 * page called October, and the weekend it offered had already gone.
 *
 * So an October surface reads from **whichever is later, now or the first of
 * October**. Before the month starts it previews the month from its first day;
 * once the month is under way `now` passes through untouched and the surface
 * advances by itself. Nothing is filtered or hidden — the near lanes are simply
 * asked about a day inside the month they are named after.
 *
 * Deliberately not in `calendar.ts`, which states that nothing in it knows
 * about October and should keep not knowing.
 */
export interface OctoberWindow {
  /** `YYYY-10-01`. */
  readonly from: string;
  /** `YYYY-10-31`. */
  readonly to: string;
  /** The year the window covers, as a string. */
  readonly year: string;
}

/** The October window for the local day `now` falls on. */
export function octoberWindow(now: Date): OctoberWindow {
  const year = localDay(now).slice(0, 4) || String(now.getUTCFullYear());
  return { from: `${year}-10-01`, to: `${year}-10-31`, year };
}

/**
 * The instant an October surface should read its near lanes from: `now`, or the
 * first of October when October has not started yet.
 *
 * Anchored at midday UTC on the first, which is the morning of October 1st in
 * the Okanagan — inside the day, so "tonight" means that day's evening rather
 * than a boundary. The same midday anchoring `calendar.ts` uses, for the same
 * daylight-saving reason.
 */
export function octoberNow(now: Date): Date {
  const { from } = octoberWindow(now);
  const today = localDay(now);
  return today >= from ? now : new Date(`${from}T12:00:00Z`);
}
