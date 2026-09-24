import type { Experience } from "@/domain/experience/types";

/**
 * **When "tonight" and "this weekend" actually are.**
 *
 * `America/Vancouver`, for the same reason `eventTime` hard-codes it: every
 * entity Atlas holds is in the Okanagan, and an Event's `startTime` is an
 * instant, so the only local time that means anything is the one printed on
 * the ticket. A traveller reading this in Toronto is being told when the thing
 * happens where it happens. When Passport covers a second region this becomes
 * a parameter; today it would be infrastructure for a problem no data has.
 *
 * Nothing here knows about October. It answers "which of these are on, and
 * when" — the October Home surface decides what to do with the answer.
 */

const ZONE = "America/Vancouver";

const ymd = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: ZONE,
});
const weekday = new Intl.DateTimeFormat("en-CA", {
  weekday: "short",
  timeZone: ZONE,
});

/** The local calendar day an instant falls on, as `2026-10-31`. */
export function localDay(at: Date | string): string {
  const d = at instanceof Date ? at : new Date(at);
  return Number.isNaN(d.getTime()) ? "" : ymd.format(d);
}

/**
 * Successive local days from `now`, anchored at midday UTC.
 *
 * The anchoring is the point: stepping by exactly 24 hours across a daylight
 * saving boundary lands on the same local day twice, or skips one. Starting
 * from noon leaves twelve hours of slack either side, which no transition
 * consumes.
 */
function* days(now: Date): Generator<{ day: string; name: string }> {
  const anchor = new Date(`${localDay(now)}T12:00:00Z`);
  for (let i = 0; i < 8; i += 1) {
    const at = new Date(anchor.getTime() + i * 86_400_000);
    yield { day: localDay(at), name: weekday.format(at) };
  }
}

/**
 * The local days the coming weekend covers — Friday, Saturday and Sunday, and
 * only the ones still ahead. On a Saturday the weekend is Saturday and Sunday,
 * not Friday and not next week's; a surface offering a person something that
 * has already happened is worse than offering nothing.
 */
export function weekendDays(now: Date): string[] {
  const out: string[] = [];
  for (const { day, name } of days(now)) {
    if (name === "Fri" || name === "Sat" || name === "Sun") out.push(day);
    if (name === "Sun" && out.length > 0) break;
  }
  return out;
}

/** Dated, in the future, and soonest first. Undated things are not events. */
function dated(experiences: readonly Experience[]): Experience[] {
  return experiences
    .filter((e) => Boolean(e.startTime))
    .sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));
}

/**
 * What is on tonight: events whose local day is today and which have not
 * already finished. An empty answer is the common one and an honest one —
 * most nights nothing is on, and Tonight says so rather than reaching further
 * out and calling next Thursday "tonight".
 */
export function happeningTonight(
  experiences: readonly Experience[],
  now: Date,
): Experience[] {
  const today = localDay(now);
  return dated(experiences).filter((e) => {
    if (localDay(e.startTime!) !== today) return false;
    const ends = e.endTime ? new Date(e.endTime) : new Date(e.startTime!);
    return ends.getTime() >= now.getTime();
  });
}

/** What is on across the coming Friday, Saturday and Sunday. */
export function happeningThisWeekend(
  experiences: readonly Experience[],
  now: Date,
): Experience[] {
  const window = new Set(weekendDays(now));
  const today = localDay(now);
  return dated(experiences).filter((e) => {
    const day = localDay(e.startTime!);
    // Today's events belong to Tonight; the weekend is what is still coming.
    return window.has(day) && day !== today;
  });
}

/**
 * Anything dated and still ahead, soonest first. The fallback when the near
 * windows are empty, so the surface can say "not tonight, but —" with
 * something real rather than filling the space.
 */
export function upcoming(
  experiences: readonly Experience[],
  now: Date,
): Experience[] {
  return dated(experiences).filter((e) => {
    const ends = e.endTime ? new Date(e.endTime) : new Date(e.startTime!);
    return ends.getTime() >= now.getTime();
  });
}
