import type { ConferenceDetails } from "./types";

/**
 * **Before, during or after — in the conference's own time zone.**
 *
 * A colleague in Sydney opening the page at 9 a.m. on the 24th, their time,
 * is still a day before a Vancouver conference that starts on the 24th. The
 * count is in whole calendar days where the conference is, because that is
 * what "three days to go" means to the people organising it.
 */
export type Countdown =
  | { readonly phase: "before"; readonly days: number }
  | { readonly phase: "during"; readonly day: number }
  | { readonly phase: "after" };

export function todayIn(timeZone: string, now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

const dayNumber = (ymd: string) => Date.parse(`${ymd}T00:00:00Z`) / 86_400_000;

export function countdown(details: ConferenceDetails, now: Date): Countdown {
  const today = dayNumber(todayIn(details.timeZone, now));
  const start = dayNumber(details.startsOn);
  const end = dayNumber(details.endsOn ?? details.startsOn);
  if (today < start) return { phase: "before", days: start - today };
  if (today <= end) return { phase: "during", day: today - start + 1 };
  return { phase: "after" };
}

/** "Saturday, October 24" or "October 24 – 27, 2026". */
export function dateRange(details: ConferenceDetails): string {
  const at = (ymd: string) => new Date(`${ymd}T12:00:00Z`);
  const fmt = (opts: Intl.DateTimeFormatOptions, ymd: string) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", ...opts }).format(
      at(ymd),
    );
  const { startsOn, endsOn } = details;
  if (!endsOn || endsOn === startsOn)
    return fmt(
      { weekday: "long", month: "long", day: "numeric", year: "numeric" },
      startsOn,
    );
  return `${fmt({ month: "long", day: "numeric" }, startsOn)} – ${fmt(
    { month: "long", day: "numeric", year: "numeric" },
    endsOn,
  )}`;
}
