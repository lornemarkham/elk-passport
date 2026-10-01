import type { Experience } from "@/domain/experience/types";
import { daysOn, weekendDays } from "./calendar";

/**
 * **The things you could actually miss, which is far fewer than you'd think.**
 *
 * ## What this refuses to count, and why
 *
 * Measured against the live corpus on 1 October: **49 subjects end within the
 * next seven days**, and 44 of them are `1 day of 1 day total` — an ordinary
 * concert, a hockey game, a comedy night. Treating those as *don't miss* would
 * put an urgency badge on forty cards, which is the same as putting one on
 * none.
 *
 * A one-off event with a date is not a closing window. It is **what is on**,
 * and October already has a lane called Tonight whose entire job is to say so.
 *
 * So the rule is narrow and it is about *losing a chance you had*:
 *
 * ```
 * it must have run for more than one day        — there was a chance to lose
 * some of those days must already be gone       — the losing has begun
 * it must be down to its last day or two        — the chance is nearly gone
 * that last day must be within three days       — it is gone soon, not later
 * ```
 *
 * On the same corpus that produces 49 "ending soon" subjects, this produces
 * between zero and three, and every one of them is defensible out loud:
 *
 * ```
 * Oct  3   Culture Days               1 day left of 17
 * Oct  9   Osoyoos Farmers' Market    2 days left of 162   (season ends)
 * Oct  9   Draconid meteor shower     2 days left of 5
 * Oct 31   Evening Haunt              1 night left of 8
 * ```
 *
 * ## It never manufactures urgency
 *
 * Every field below is arithmetic on days Atlas states. There is no editorial
 * input, no popularity, no "while it lasts". A subject with no stated days
 * cannot qualify at all, and when nothing qualifies the caller renders
 * nothing — the treatment disappears rather than finding its best candidate.
 */

/** Past this many days away, an ending is not yet something to act on. */
const CLOSING_WITHIN_DAYS = 3;
/** More chances left than this and you are not about to miss anything. */
const AT_MOST_LEFT = 2;

export interface Closing {
  /** The subject's own last day, `YYYY-MM-DD`. */
  readonly lastDay: string;
  /** Days from today until it ends. 0 means today is the last one. */
  readonly endsInDays: number;
  /** How many days it is still on, including today. 1 or 2. */
  readonly daysLeft: number;
  /** How many days it ran in total. Always greater than `daysLeft`. */
  readonly daysInRun: number;
  /** What a person reads: "Final night — Saturday." */
  readonly reason: string;
  /**
   * How strong this is, for ordering when more than one qualifies. A long run
   * ending today beats a short one ending tomorrow, because a season closing
   * is a bigger loss than a five-day shower closing.
   */
  readonly strength: number;
}

const DAY_MS = 86_400_000;
const daysBetween = (from: string, to: string): number =>
  Math.round(
    (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / DAY_MS,
  );

const weekdayOf = (day: string): string =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("en-CA", {
    weekday: "long",
    timeZone: "UTC",
  });

/**
 * Whether this subject's window is closing, and what to say about it.
 *
 * `atNight` comes from the subject classifier, so a haunt gets "final night"
 * and a market gets "last day" — the difference is only ever a word, never a
 * different rule.
 */
export function closingFor(
  experience: Experience,
  today: string,
  atNight: boolean,
  now: Date = new Date(`${today}T12:00:00Z`),
): Closing | undefined {
  const days = daysOn(experience);
  // A single-date thing never had a run to lose. That is Tonight's job.
  if (days.length < 2) return undefined;

  const remaining = days.filter((day) => day >= today);
  if (remaining.length === 0) return undefined;
  if (remaining.length > AT_MOST_LEFT) return undefined;
  // **Some of it must already be gone.** A two-day event with both days still
  // ahead has not started closing — it is simply a short event, and calling
  // its opening night a final weekend is manufactured urgency. Measured: this
  // alone removes The Odditorium, the Anti-Thanksgiving Dinner and the
  // Haunted Houses of Pleasant Valley, all of which are 2-of-2.
  if (remaining.length >= days.length) return undefined;

  const lastDay = days[days.length - 1]!;
  const endsInDays = daysBetween(today, lastDay);
  if (endsInDays < 0 || endsInDays > CLOSING_WITHIN_DAYS) return undefined;

  const daysLeft = remaining.length;
  const unit = atNight ? "night" : "day";

  // A run whose remaining days are all this weekend is a final weekend, which
  // is a more useful thing to be told than "two days left".
  const weekend = new Set(weekendDays(now));
  const finalWeekend =
    daysLeft === 2 && remaining.every((day) => weekend.has(day));

  const reason = finalWeekend
    ? "Final weekend."
    : daysLeft === 2
      ? `Last two ${unit}s — ends ${weekdayOf(lastDay)}.`
      : endsInDays === 0
        ? `Final ${unit} — tonight.`
        : endsInDays === 1
          ? `Final ${unit} — tomorrow.`
          : `Final ${unit} — ${weekdayOf(lastDay)}.`;

  return {
    lastDay,
    endsInDays,
    daysLeft,
    daysInRun: days.length,
    reason,
    // Fewer chances left dominates; a longer run breaks the tie, because the
    // end of a 162-day season is a bigger loss than the end of a 5-day one.
    strength: (AT_MOST_LEFT - daysLeft) * 1000 + Math.min(days.length, 400),
  };
}

/**
 * **The one or two things worth saying this about.**
 *
 * Capped hard. The value of "don't miss" is inversely proportional to how
 * often it is said, and a list of six is a list of none — so the cap is two
 * and it is usually one.
 */
export function dontMiss<T>(
  items: readonly T[],
  of: (item: T) => Closing | undefined,
  limit = 2,
): readonly { item: T; closing: Closing }[] {
  return items
    .map((item) => ({ item, closing: of(item) }))
    .filter((x): x is { item: T; closing: Closing } => Boolean(x.closing))
    .sort(
      (a, b) =>
        b.closing.strength - a.closing.strength ||
        a.closing.endsInDays - b.closing.endsInDays,
    )
    .slice(0, limit);
}
