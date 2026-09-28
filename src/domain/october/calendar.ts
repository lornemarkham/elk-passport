import type { Experience } from "@/domain/experience/types";
import { localDay, statedDay } from "@/domain/experience/eventTime";

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

const weekday = new Intl.DateTimeFormat("en-CA", {
  weekday: "short",
  timeZone: ZONE,
});

/**
 * Re-exported so the surfaces that ask "what local day is it *now*" keep one
 * import. The definition moved to `eventTime`, which owns the zone, the local
 * day and `statedDay` together — there were three independent localisers and
 * that is how a date-only Event came to be a day early on the cards and a day
 * early in the buckets, separately.
 */
export { localDay };

/**
 * **The calendar day an Event's own timestamp means** — `statedDay`, never
 * `localDay`.
 *
 * `localDay` is right for `now`, which really is an instant. It is wrong for a
 * date-only Event, whose stored instant is UTC midnight on the date its
 * publisher printed: localising that lands on the evening before. Every window
 * below reads Event timestamps through here so one rule decides every bucket.
 */
const dayOfEvent = (experience: Experience, at: string | undefined): string =>
  statedDay(at, experience.timePrecision);

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

/** Claim-bearing subjects whose evidence names at least one of `days`. */
function onStatedDays(
  experiences: readonly Experience[],
  days: ReadonlySet<string>,
): Experience[] {
  return experiences.filter((e) => statedDays(e).some((day) => days.has(day)));
}

/**
 * **An occasion, or a span in which something is available.**
 *
 * Atlas holds 174 Events and 40 of them run for longer than a fortnight. Some
 * are real — a sixteen-day arts festival is one thing that happens — and some
 * are a different shape of fact wearing an Event's clothes:
 *
 * ```
 * 364d  Japan Tours 2027      "now booking paragliding tours for 2027"
 * 269d  Hiring Event Staff    "is hiring vendor staff … for the entire season"
 * 147d  Sunday Fundays        every Sunday, May to September
 * 107d  Farmers' Market       June to September
 * ```
 *
 * None of those is something a person attends on a particular evening, and
 * asking "is it on tonight?" of a hiring window is a category error. Three
 * weeks is where the line goes: a festival can run a fortnight and a bit, and
 * anything longer is a season or an availability window whatever it is called.
 *
 * This is a **product judgement about which lane a thing belongs in**, not a
 * claim that the Event is wrong. A long Event is still dated, still true, and
 * still appears in a month window — where "what is on in October" is exactly
 * the right question for it.
 */
export const OCCASION_MAX_DAYS = 21;

const DAY_MS = 86_400_000;

/** How many local days an Event's own interval covers. */
function spanDays(experience: Experience): number {
  if (!experience.startTime) return 0;
  const from = Date.parse(
    `${dayOfEvent(experience, experience.startTime)}T12:00:00Z`,
  );
  const to = Date.parse(
    `${dayOfEvent(experience, experience.endTime ?? experience.startTime)}T12:00:00Z`,
  );
  return Number.isNaN(from) || Number.isNaN(to)
    ? 0
    : Math.round((to - from) / DAY_MS);
}

/** An Event short enough to be one occasion rather than a season. */
const isOccasion = (experience: Experience): boolean =>
  spanDays(experience) <= OCCASION_MAX_DAYS;

/** The local days an Event's interval covers. */
function eventDays(experience: Experience): readonly string[] {
  if (!experience.startTime) return [];
  const first = Date.parse(
    `${dayOfEvent(experience, experience.startTime)}T12:00:00Z`,
  );
  const last = Date.parse(
    `${dayOfEvent(experience, experience.endTime ?? experience.startTime)}T12:00:00Z`,
  );
  if (Number.isNaN(first) || Number.isNaN(last)) return [];
  const out: string[] = [];
  // Each step is a midday-UTC anchor, so the day it names is read off UTC —
  // these are already calendar days, not instants to be localised again.
  for (let at = first; at <= last; at += DAY_MS)
    out.push(new Date(at).toISOString().slice(0, 10));
  return out;
}

/**
 * **When the next thing a person could turn up for happens**, as a day, from
 * `fromDay` onwards — the one signal every lane orders by.
 *
 * Deliberately the same question for both shapes of evidence, because a
 * traveller does not sort by entity kind: an Event answers with its own start,
 * or with today if it is already running, and a claim-bearing subject answers
 * with the next day its source named. `undefined` means nothing is ahead.
 */
export function nextRelevantDay(
  experience: Experience,
  fromDay: string,
): string | undefined {
  const days = experience.startTime
    ? eventDays(experience)
    : statedDays(experience);
  return days.find((day) => day >= fromDay);
}

/**
 * One deterministic order for every lane: soonest first, then the time of day
 * where a publisher stated one, then the name.
 *
 * A stated clock time sorts ahead of no clock time at all — which is about how
 * much is known, not about what kind of record it is. Two things with the same
 * day and no time fall back to the name, so a lane never shuffles between
 * renders.
 */
function bySoonest(fromDay: string) {
  const day = (e: Experience) => nextRelevantDay(e, fromDay) ?? "9999-99-99";
  // Plain comparison for anything ISO-shaped, and `localeCompare` only for a
  // title. A locale collator treats punctuation as nearly weightless, so a
  // sentinel like "~" sorted *before* a timestamp and a timed Event lost its
  // place to an untimed one — found by the test that pins this order.
  return (a: Experience, b: Experience): number => {
    if (day(a) !== day(b)) return day(a) < day(b) ? -1 : 1;
    const untimed = (e: Experience) => (e.startTime ? 0 : 1);
    if (untimed(a) !== untimed(b)) return untimed(a) - untimed(b);
    if (a.startTime && b.startTime && a.startTime !== b.startTime) {
      return a.startTime < b.startTime ? -1 : 1;
    }
    return a.title.localeCompare(b.title);
  };
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
    // An Event that starts today is on tonight until it has finished.
    if (dayOfEvent(e, e.startTime) === today) {
      // **"Has it finished?" can only be asked of an event that said when.**
      // A date-only Event's stored instant is UTC midnight on its stated date,
      // which in this region is the evening BEFORE — so comparing it to the
      // clock dropped every day-precision event from Tonight before the day it
      // is on had begun. HorrorFest XVII, stated for Oct 24, was already "over"
      // at 10 a.m. on Oct 24. A publisher who printed no time stated a whole
      // day, and the thing is on for all of it. This is the same distinction
      // the stated-days branch below already makes, and it is in the evidence
      // rather than in a policy.
      if (e.timePrecision === "day") return true;
      const ends = e.endTime ? new Date(e.endTime) : new Date(e.startTime!);
      return ends.getTime() >= now.getTime();
    }
    // One that began earlier and is still running is also on tonight — but only
    // if it is an occasion. An exhibition open until Sunday is something to do
    // this evening; a nine-month hiring window is not, and neither is a booking
    // year (`OCCASION_MAX_DAYS`).
    return isOccasion(e) && eventDays(e).includes(today);
  });
  // A stated day has no clock on it, so an attraction open tonight stays in
  // Tonight for the whole of tonight. An Event knows when it ends and is
  // dropped once it has; that difference is in the evidence, not a policy.
  return [...events, ...onStatedDays(experiences, new Set([today]))].sort(
    bySoonest(today),
  );
}

/** What is on across the coming Friday, Saturday and Sunday. */
export function happeningThisWeekend(
  experiences: readonly Experience[],
  now: Date,
): Experience[] {
  const today = localDay(now);
  const window = new Set(weekendDays(now).filter((day) => day !== today));
  const first = [...window].sort()[0] ?? today;
  const events = dated(experiences).filter(
    (e) =>
      window.has(dayOfEvent(e, e.startTime)) ||
      (isOccasion(e) && eventDays(e).some((day) => window.has(day))),
  );
  return [...events, ...onStatedDays(experiences, window)].sort(
    bySoonest(first),
  );
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
  // **Coming up means it has not started yet.** It used to mean "its end is
  // still in the future", which put a market that opened in June at the head of
  // the lane and a hiring window running until next summer above tonight's
  // concert. Something already under way is not coming; it is here, and
  // Tonight, This weekend and a month window are where a person meets it.
  const events = dated(experiences).filter(
    (e) => isOccasion(e) && dayOfEvent(e, e.startTime) > today,
  );
  const claimed = experiences.filter((e) =>
    statedDays(e).some((day) => day > today),
  );
  return [...events, ...claimed].sort(bySoonest(today));
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
    const starts = dayOfEvent(e, e.startTime);
    const ends = dayOfEvent(e, e.endTime ?? e.startTime);
    return starts <= toDay && ends >= fromDay;
  });
  const claimed = experiences.filter((e) => statedDays(e).some(inRange));
  // Soonest inside the window, whatever kind of evidence says so. A month's
  // Events used to sort ahead of every claim-bearing Thing simply because they
  // were Events, which put a haunt running all month below a one-off that had
  // already happened.
  return [...events, ...claimed].sort(bySoonest(fromDay));
}
