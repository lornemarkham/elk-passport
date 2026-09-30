import { localDay } from "@/domain/experience/eventTime";
import type { Experience } from "@/domain/experience/types";
import { daysOn, weekendDays } from "./calendar";

/**
 * **How close a saved thing is, from the evidence it already carries.**
 *
 * My October answered *what have I kept* and not *what is coming*. The rows
 * were a list in the order they were saved, so a haunt on tonight sat below a
 * concert three weeks out, and nothing on the page said which was which.
 *
 * ## Three shapes of evidence, measured on the live corpus
 *
 * ```
 * an Event's interval    Draconids, Oct 6 → Oct 10, date-only
 *                        Top 3 Comedy, Oct 9, one day
 *                        Sagebrush's trail, Oct 3 → Oct 31, a month-long run
 * stated days            Field of Screams: 38 named nights, Sep 25 → Nov 1,
 *                        and they are a *list*, not a range
 * nothing at all         Black Mountain, whose nights live on its modes and
 *                        whose own record says `unstated`; and every film
 * ```
 *
 * `daysOn` answers all three with one rule, so nothing here re-derives a date
 * from a timestamp. Everything below is calendar-day arithmetic on strings,
 * which is why no daylight-saving boundary can move an answer.
 *
 * ## What it refuses to do
 *
 * A subject with no usable days gets `unknown` and no urgency of any kind.
 * There is no "probably soon", no guess from when it was saved, and no
 * treating a 38-night list as a span — the difference between *38 nights
 * between these dates* and *38 consecutive nights* is 38 days of false
 * promises.
 *
 * And nothing here ever says a thing was **lived**. A day passing is not a
 * person going: `passed` means the calendar moved on, and only they can say
 * whether they were there.
 */

export type Nearness =
  /** On today, and on again after today. */
  | "running"
  /** On today, and today is the last of it. */
  | "tonight"
  | "tomorrow"
  | "weekend"
  /** Within the fortnight, counted in days. */
  | "soon"
  /** Further out than a fortnight, named by its date. */
  | "dated"
  /** Every day it names is behind us. Not lived — just gone. */
  | "passed"
  /** Atlas holds no day for it. A film, or a subject whose modes carry them. */
  | "unknown";

export interface Anticipation {
  readonly nearness: Nearness;
  /** What a person reads: "Tonight", "In 6 days", "Oct 24", "Passed". */
  readonly label: string;
  /** The day it turns on, `YYYY-MM-DD`. Absent for `unknown` and `passed`. */
  readonly day?: string;
  /** Today is the last day this is on — said only when more days preceded it. */
  readonly lastChance?: true;
  /**
   * How many nights the evidence **lists**, where it lists them.
   *
   * Only for a subject whose days are a list — Field of Screams' nights have
   * gaps in them, so a range would claim the twenty days between. An Event
   * carries an interval instead, and the row already prints it in full; a
   * count beside it would say the same thing twice.
   */
  readonly nights?: number;
}

/** Two calendar days apart, via midday anchors so no transition can shift it. */
function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T12:00:00Z`);
  const b = Date.parse(`${to}T12:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/** `Oct 24` — enough to place it, and no more. */
const shortDay = (day: string): string =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

/**
 * Where a fortnight ends. Inside it a person is counting days; beyond it they
 * want a date, because "in 26 days" is a number nobody converts into a plan.
 */
const COUNTED_DAYS = 14;

const NOTHING: Anticipation = { nearness: "unknown", label: "" };

/**
 * **What a saved thing's own evidence says about how close it is.**
 *
 * `experience` is the live Atlas record where My October still has one;
 * `startsAt` is the snapshot the row kept, which is what answers when Atlas
 * has retired the entity. Neither is required — a thing with neither is
 * `unknown`, which is a real state and not a failure.
 *
 * `now` is always supplied by the caller. A module that reached for the clock
 * itself could not be tested against a Tuesday in October.
 */
export function anticipate(
  { startsAt }: { readonly startsAt?: string | null },
  experience: Experience | undefined,
  now: Date,
): Anticipation {
  const today = localDay(now);

  // The live record's days where there is one, else the single day the row
  // remembered. `daysOn` is the same rule every October lane sorts by.
  //
  // **The snapshot is a weaker answer, and knowingly so.** The row stores
  // `starts_at` as an instant and stores no `timePrecision`, so a date-only
  // Event kept at UTC midnight reads here as the previous local evening —
  // the Draconids' "Oct 6" becomes the 5th once Atlas stops returning the
  // subject. Reading UTC midnight as "date-only" would correct those and
  // break every genuine 5 p.m. event; that heuristic was measured against
  // this corpus and rejected. The live record is right whenever there is
  // one, which is every case but a retired entity.
  const days = experience
    ? daysOn(experience)
    : startsAt
      ? [localDay(startsAt)]
      : [];
  if (days.length === 0) return NOTHING;

  // Only a list is countable. An interval says itself.
  const nights = experience?.startTime ? undefined : days.length;
  const next = days.find((day) => day >= today);

  if (!next) {
    // Every day it named is behind us. It stays Ahead and stays theirs to
    // say what happened — the calendar has an opinion, the person has the
    // answer, and only one of those belongs in `state`.
    return { nearness: "passed", label: "Passed" };
  }

  const last = days[days.length - 1]!;
  // There were earlier days to have missed — true of a list and of a run
  // alike, which is why this counts the days themselves rather than `nights`.
  const lastChance = next === last && days.length > 1 ? true : undefined;

  if (next === today) {
    const more = days.some((day) => day > today);
    return {
      nearness: more ? "running" : "tonight",
      // "On tonight" is Discover's own words for the same fact.
      label: more ? "On now" : "Tonight",
      day: today,
      ...(lastChance ? { lastChance } : {}),
      ...(nights && nights > 1 ? { nights } : {}),
    };
  }

  const away = daysBetween(today, next);

  if (away === 1) {
    return {
      nearness: "tomorrow",
      label: "Tomorrow",
      day: next,
      ...(lastChance ? { lastChance } : {}),
      ...(nights && nights > 1 ? { nights } : {}),
    };
  }

  // The weekend October's own lanes mean — Friday to Sunday, and only the
  // part still ahead. Tomorrow wins where they overlap, because tomorrow is
  // the more useful of two true things.
  if (weekendDays(now).includes(next)) {
    return {
      nearness: "weekend",
      label: "This weekend",
      day: next,
      ...(lastChance ? { lastChance } : {}),
      ...(nights && nights > 1 ? { nights } : {}),
    };
  }

  if (away <= COUNTED_DAYS) {
    return {
      nearness: "soon",
      label: `In ${away} days`,
      day: next,
      ...(lastChance ? { lastChance } : {}),
      ...(nights && nights > 1 ? { nights } : {}),
    };
  }

  return {
    nearness: "dated",
    label: shortDay(next),
    day: next,
    ...(lastChance ? { lastChance } : {}),
    ...(nights && nights > 1 ? { nights } : {}),
  };
}

/** Whether this anticipation should sort among the dated things at all. */
const isDated = (a: Anticipation): boolean =>
  a.day !== undefined && a.nearness !== "passed";

/**
 * **Ahead, in the order a person would ask for it.**
 *
 * Soonest first; then everything October holds no date for, newest intention
 * first as it always was; then the ones the calendar has already gone past.
 *
 * The old order read the row's `startsAt` snapshot alone, which is set for
 * Events and nothing else — so Field of Screams, on tonight, sorted below a
 * concert three weeks out because its dates live in `availability.days`
 * rather than in a timestamp. Ordering by the derived day fixes both shapes at
 * once.
 *
 * Deterministic to the last tie: same day, then a stated clock time ahead of
 * none, then the name, so a list never shuffles between two renders.
 */
export function bySoonestAnticipated<T>(
  of: (item: T) => {
    readonly anticipation: Anticipation;
    readonly startsAt?: string | null;
    readonly name: string;
    readonly wantedAt: string;
  },
) {
  return (left: T, right: T): number => {
    const a = of(left);
    const b = of(right);

    const rank = (x: typeof a) =>
      isDated(x.anticipation)
        ? 0
        : x.anticipation.nearness === "passed"
          ? 2
          : 1;
    if (rank(a) !== rank(b)) return rank(a) - rank(b);

    if (rank(a) === 0) {
      const dayA = a.anticipation.day!;
      const dayB = b.anticipation.day!;
      if (dayA !== dayB) return dayA < dayB ? -1 : 1;

      // Same day, so what separates them is how many chances are left. A
      // thing that is only on tonight is gone tomorrow; a run is not. Miss
      // the first and you have missed it.
      const chancesLeft = (x: typeof a) =>
        x.anticipation.nearness === "running" ? 1 : 0;
      if (chancesLeft(a) !== chancesLeft(b))
        return chancesLeft(a) - chancesLeft(b);
      // A stated clock sorts ahead of no clock — about how much is known,
      // not about what kind of record it is.
      const untimed = (x: typeof a) => (x.startsAt ? 0 : 1);
      if (untimed(a) !== untimed(b)) return untimed(a) - untimed(b);
      if (a.startsAt && b.startsAt && a.startsAt !== b.startsAt) {
        return a.startsAt < b.startsAt ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    }

    // Undated and passed alike: the most recent intention first, which is
    // the order these have always had.
    return b.wantedAt.localeCompare(a.wantedAt);
  };
}
