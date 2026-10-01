/**
 * **Where you are in October, which is not the same as what the date is.**
 *
 * A date label is inert. *October starts tomorrow* is not — it is the same
 * fact, read as a person reads it, and it is the difference between a page
 * that displays the 30th of September and a page that knows what the 30th of
 * September means.
 *
 * ## Derived, never a list of slogans
 *
 * Everything below is arithmetic on a calendar date in one timezone. There is
 * no table of canned sentences keyed by day, because a table would have to be
 * written once per day and would be wrong the following year. Six different
 * days feel different because six different facts are true on them, not
 * because somebody designed six pages.
 *
 * ## It is allowed to say nothing
 *
 * Most days in the middle of October have nothing remarkable about them, and
 * `headline` is `undefined` on those. A product that produces a thrilled
 * sentence every single day has taught people to stop reading the sentence.
 */

export type OctoberPhase =
  /** Before the month. The anticipation is the whole feeling. */
  | "eve"
  | "early"
  | "middle"
  | "late"
  | "halloween"
  /** November. October is over and should say so once, not pretend. */
  | "after";

export interface TemporalContext {
  /** `YYYY-MM-DD` in the product's timezone. */
  readonly day: string;
  readonly weekday: string;
  readonly phase: OctoberPhase;
  /** 1–31 during October, else undefined. */
  readonly dayOfOctober?: number;
  /** Nights between now and the 31st. 0 on the day itself. */
  readonly daysToHalloween?: number;
  /**
   * The one thing worth saying about today, if anything is.
   *
   * Ordered by how much it would change what somebody does, which is why
   * "October starts tomorrow" beats "it is Wednesday".
   */
  readonly headline?: string;
}

/** The calendar parts of an instant, in one zone, without string parsing. */
function partsIn(now: Date, timeZone: string) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
  });
  const got: Record<string, string> = {};
  for (const p of f.formatToParts(now)) got[p.type] = p.value;
  return {
    year: Number(got.year),
    month: Number(got.month),
    date: Number(got.day),
    weekday: got.weekday!,
    day: `${got.year}-${got.month}-${got.day}`,
  };
}

/** Which Friday of the month a date is, 1-based. */
function nthWeekdayOfMonth(year: number, month: number, date: number): number {
  return Math.floor((date - 1) / 7) + 1;
}

const isFriday = (weekday: string) => weekday === "Friday";

export function temporalContext(
  now: Date,
  timeZone = "America/Vancouver",
): TemporalContext {
  const { year, month, date, weekday, day } = partsIn(now, timeZone);

  // Days from today to October 1st of the relevant year, by calendar date
  // rather than by instant, so a transition cannot move it.
  const toOctoberFirst = Math.round(
    (Date.UTC(year, 9, 1) - Date.UTC(year, month - 1, date)) / 86_400_000,
  );

  if (month < 10) {
    const phase: OctoberPhase = "eve";
    return {
      day,
      weekday,
      phase,
      headline:
        toOctoberFirst === 1
          ? "October starts tomorrow."
          : toOctoberFirst <= 7
            ? `October starts in ${toOctoberFirst} days.`
            : undefined,
    };
  }

  if (month > 10) {
    return { day, weekday, phase: "after" };
  }

  const daysToHalloween = 31 - date;
  const phase: OctoberPhase =
    date === 31
      ? "halloween"
      : date <= 10
        ? "early"
        : date <= 21
          ? "middle"
          : "late";

  return {
    day,
    weekday,
    phase,
    dayOfOctober: date,
    daysToHalloween,
    headline: headlineFor(year, date, weekday, daysToHalloween),
  };
}

/**
 * The strongest true thing about an October day, or nothing.
 *
 * The order is the point. On the 31st nothing else matters; on the first
 * Friday the weekend matters more than the countdown; in the middle of the
 * month, usually nothing does.
 */
function headlineFor(
  year: number,
  date: number,
  weekday: string,
  daysToHalloween: number,
): string | undefined {
  if (date === 31) return "It's Halloween.";
  if (daysToHalloween === 1) return "Halloween is tomorrow.";
  if (date === 1) return "October starts today.";

  if (isFriday(weekday)) {
    const nth = nthWeekdayOfMonth(year, 10, date);
    if (nth === 1) return "The first Friday night of October.";
    // The last Friday before the 31st is the one everything happens on.
    if (daysToHalloween <= 7) return "The last Friday before Halloween.";
  }

  if (daysToHalloween <= 7) return `${daysToHalloween} nights to Halloween.`;
  if (date === 15) return "Halfway through October.";
  return undefined;
}
