import type { Experience } from "@/domain/experience/types";

/**
 * **A run is not a recurrence, and "happening today" has to know the
 * difference.**
 *
 * The defect this closes, with real production data: **Osoyoos Farmers' Market
 * 2026 Season** holds a 161-day interval and `weekdays: ["saturday"]`. The
 * composed page read only the interval, so it put the market under *Happening
 * today* on a Tuesday — and on the Wednesday, and the Thursday. It is open 23
 * days out of 161, and Passport claimed 161.
 *
 * `candidate-occurrence/2` states the pattern, so Passport can stop inferring
 * one from a span. Measured on production: 365 candidates carry an occurrence,
 * **16 carry a `weekdays` or `days` pattern**.
 *
 * ## Only ever narrowing, never widening
 *
 * This answers *"does the pattern rule today out?"* — nothing else. A subject
 * with no pattern is unchanged, which is 349 of the 365 and the whole rest of
 * the corpus. Atlas stating no pattern is not evidence that a thing runs daily;
 * it is evidence of nothing, and the interval keeps whatever claim it had.
 */
const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

/**
 * The weekday a `YYYY-MM-DD` falls on, read at noon UTC.
 *
 * Noon rather than midnight because a date parsed as UTC midnight is the
 * previous evening in Vancouver, which is how a Saturday market ends up
 * advertised on a Friday. `dayOf` already produces these keys in `ZONE`, so
 * the key is local and only its weekday is wanted.
 */
export function weekdayOf(day: string): string | undefined {
  const at = Date.parse(`${day}T12:00:00Z`);
  if (Number.isNaN(at)) return undefined;
  return WEEKDAYS[new Date(at).getUTCDay()];
}

/**
 * **Whether Atlas's stated pattern rules this day out.**
 *
 * `false` only when there *is* a pattern and the day is not in it. Silence
 * never rules anything out.
 */
export function ruledOutOn(experience: Experience, day: string): boolean {
  const occurrence = experience.occurrence;
  if (!occurrence) return false;

  const { days, weekdays } = occurrence;

  // An explicit schedule is the strongest thing Atlas can say: these are the
  // open days, and the ends of the interval are just the first and the last.
  if (days && days.length > 0) return !days.includes(day);

  if (weekdays && weekdays.length > 0) {
    const weekday = weekdayOf(day);
    // An unparseable day is not evidence against anything.
    if (!weekday) return false;
    return !weekdays.some((stated) => stated.toLowerCase() === weekday);
  }

  return false;
}

/** Whether Atlas states a pattern at all, so a surface can say what it knows. */
export const hasPattern = (experience: Experience): boolean =>
  Boolean(
    experience.occurrence?.days?.length ||
    experience.occurrence?.weekdays?.length,
  );

/**
 * **What a card may say about when it recurs.**
 *
 * Atlas's own weekday names, title-cased for reading and nothing more. Never
 * invented: a subject with no stated pattern gets no sentence, however much a
 * long interval looks like a season.
 */
export function recurrenceLine(experience: Experience): string | undefined {
  const occurrence = experience.occurrence;
  const weekdays = occurrence?.weekdays;
  if (weekdays && weekdays.length > 0) {
    const named = weekdays
      .map((day) => day.charAt(0).toUpperCase() + day.slice(1))
      .join(", ");
    return weekdays.length === 1 ? `${named}s` : named;
  }
  const days = occurrence?.days;
  if (days && days.length > 0) {
    return `${days.length} dates`;
  }
  return undefined;
}
