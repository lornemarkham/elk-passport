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
 *
 * ## Two kinds of evidence, one set of windows (2026-09-27)
 *
 * These functions used to read `startTime` and nothing else, so they could only
 * ever see Events. Atlas now says, per candidate, what it knows about when the
 * thing is on (`availability`), and the two shapes are genuinely different:
 *
 * ```
 * an Event          one stated instant pair          startTime / endTime
 * a claim-bearing   the calendar days a source names  availability.days
 *   subject         — or a weekday pattern and no day at all
 * ```
 *
 * So the windows below ask one question — *which local days is this on?* — and
 * take the answer from whichever evidence exists. The Event path is unchanged,
 * to the line. A subject whose evidence names **no** day is never "on" a
 * particular day here, and that is not the same as being closed: Usher states
 * Tuesday-to-Sunday showtimes on a page that prints no year, so Atlas can say
 * which weekdays and cannot say which dates, and neither can this.
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
 * The local days Atlas's evidence names for a subject that is not an Event,
 * ascending. Empty for everything Atlas holds no dated claim about — a park, a
 * restaurant, an attraction whose modes carry the dates, and a production whose
 * page never printed a year.
 *
 * Read, never derived: Atlas expanded the weekday patterns and the exclusions
 * already, using the claims' own `claimCoversDay`. Passport holds no second
 * copy of that rule and must not grow one.
 */
function statedDays(experience: Experience): readonly string[] {
  if (experience.startTime) return [];
  return experience.availability?.days ?? [];
}

/** Claim-bearing subjects whose evidence names at least one of `days`, by name for a stable order. */
function onStatedDays(
  experiences: readonly Experience[],
  days: ReadonlySet<string>,
): Experience[] {
  return experiences
    .filter((e) => statedDays(e).some((day) => days.has(day)))
    .sort((a, b) => a.title.localeCompare(b.title));
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
  const events = dated(experiences).filter((e) => {
    if (localDay(e.startTime!) !== today) return false;
    const ends = e.endTime ? new Date(e.endTime) : new Date(e.startTime!);
    return ends.getTime() >= now.getTime();
  });
  // A stated day has no clock on it, so an attraction open tonight stays in
  // Tonight for the whole of tonight. An Event knows when it ends and is
  // dropped once it has; that difference is in the evidence, not a policy.
  return [...events, ...onStatedDays(experiences, new Set([today]))];
}

/** What is on across the coming Friday, Saturday and Sunday. */
export function happeningThisWeekend(
  experiences: readonly Experience[],
  now: Date,
): Experience[] {
  const today = localDay(now);
  const window = new Set(weekendDays(now).filter((day) => day !== today));
  const events = dated(experiences).filter((e) =>
    window.has(localDay(e.startTime!)),
  );
  return [...events, ...onStatedDays(experiences, window)];
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
  const today = localDay(now);
  const events = dated(experiences).filter((e) => {
    const ends = e.endTime ? new Date(e.endTime) : new Date(e.startTime!);
    return ends.getTime() >= now.getTime();
  });
  const claimed = experiences
    .filter((e) => statedDays(e).some((day) => day >= today))
    .sort((a, b) => {
      const soonest = (x: Experience) =>
        statedDays(x).find((day) => day >= today) ?? "";
      return (
        soonest(a).localeCompare(soonest(b)) || a.title.localeCompare(b.title)
      );
    });
  return [...events, ...claimed];
}

/**
 * Everything on between two local days, inclusive — the window an "all of
 * October" surface asks for.
 *
 * An Event is in when its own interval meets the range, so a festival that
 * began before it and is still running is in it; that is the same intersection
 * Atlas applies, and the reason it is not the start-day test the near windows
 * use. A claim-bearing subject is in when the evidence names a day inside it.
 */
export function happeningWithin(
  experiences: readonly Experience[],
  fromDay: string,
  toDay: string,
): Experience[] {
  const inRange = (day: string) => day >= fromDay && day <= toDay;
  const events = dated(experiences).filter((e) => {
    const starts = localDay(e.startTime!);
    const ends = localDay(e.endTime ?? e.startTime!);
    return starts <= toDay && ends >= fromDay;
  });
  const claimed = experiences
    .filter((e) => statedDays(e).some(inRange))
    .sort((a, b) => {
      const first = (x: Experience) => statedDays(x).find(inRange) ?? "";
      return first(a).localeCompare(first(b)) || a.title.localeCompare(b.title);
    });
  return [...events, ...claimed];
}
