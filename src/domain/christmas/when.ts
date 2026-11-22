import type { Experience } from "@/domain/experience/types";
import { formatEventWhen, statedDay } from "@/domain/experience/eventTime";

/**
 * **When a Christmas find happens, and how sure Passport may sound.**
 *
 * Christmas is the most dated thing Passport does: a market is open for five
 * weeks, Canyon Lights for seven, Santa's Workshop for one. So every find
 * carries one of four readings, and the card's confidence comes from it —
 * never from how good the thing looks (doctrine §2.3, §5):
 *
 * ```
 * dated        Atlas holds this season's dates and says they can be acted on
 * check        Atlas holds a span, or the organiser's own words, but not which
 *              days inside it — "Nov 16 – Dec 24" with no hours
 * unconfirmed  Christmas evidence, and no dates for this season at all
 * past         the latest dates Atlas holds have already gone — a market last
 *              listed for 2023 is not on this year until somebody says so
 * ```
 *
 * `past` is not hidden: it is somewhere a family may well love, and saying
 * "last listed for December 2023" is exactly the honest answer (§2.4: let
 * people want things that cannot happen today).
 */

/** Longest run still read as dated days; a Christmas market's six weeks is well inside it. */
export const MAX_CONFIRMED_SPAN = 75;

const daysBetween = (a: string, b: string) =>
  Math.round(
    (Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000,
  );

export type Confidence = "dated" | "check" | "unconfirmed" | "past";

/**
 * Where a dated find sits against today: `now` (the run has begun and not
 * ended), `upcoming` (starts later), `finished` (over). Undated finds have
 * none — Passport does not say when it does not know.
 */
export type Phase = "now" | "upcoming" | "finished";

export interface WhenReading {
  readonly confidence: Confidence;
  readonly phase?: Phase;
  /** The calendar days Atlas states, `YYYY-MM-DD`, first and last. */
  readonly from?: string;
  readonly to?: string;
  /** What the card prints. Atlas's dates, or the organiser's words, quoted. */
  readonly line?: string;
  /** Why the confidence is what it is, in a sentence. */
  readonly because: string;
}

/** Labels for the confidence chip. Short; the `because` says the rest. */
export const CONFIDENCE_LABEL: Readonly<Record<Confidence, string>> = {
  dated: "Dates confirmed",
  check: "Check the days",
  unconfirmed: "Dates not confirmed",
  past: "Earlier dates",
};

/** What the badge says for a dated find: running now, or coming up. */
export const PHASE_LABEL: Readonly<Record<Phase, string>> = {
  now: "On now",
  upcoming: "Upcoming",
  finished: "Finished",
};

const phaseOf = (from: string, to: string, today: string): Phase =>
  to < today ? "finished" : from > today ? "upcoming" : "now";

/** Organiser facts that read as when it is on — quoted, never parsed. */
const WHEN_LABEL =
  /\b(hours|dates?|open|season|schedule|runs?|when|times?|days?)\b/i;
const SEASON_WORD =
  /\b(nov(ember)?|dec(ember)?|jan(uary)?|christmas|holiday|winter|festive|advent)\b/i;

function publishedWhen(experience: Experience): string | undefined {
  for (const p of experience.knowledge?.practical ?? []) {
    if (WHEN_LABEL.test(p.label) && SEASON_WORD.test(`${p.label} ${p.value}`))
      return `${p.label}: ${p.value}`;
  }
  return undefined;
}

/**
 * The organiser's words name an earlier year and never this one ("Nov 20 –
 * Dec 24, 2024"): that is last year's schedule, not this year's.
 */
function namesOnlyEarlierYears(text: string, today: string): boolean {
  const year = Number(today.slice(0, 4));
  const years = (text.match(/\b(20\d{2})\b/g) ?? []).map(Number);
  return years.length > 0 && years.every((y) => y < year);
}

/**
 * Read one find against today (`YYYY-MM-DD`, Pacific — the caller's
 * `todayIn()`).
 */
export function readWhen(experience: Experience, today: string): WhenReading {
  const published = publishedWhen(experience);
  if (experience.kind === "Event" && experience.startTime) {
    const from = statedDay(experience.startTime, experience.timePrecision);
    const to =
      statedDay(
        experience.endTime ?? experience.startTime,
        experience.timePrecision,
      ) || from;
    const line = formatEventWhen(
      experience.startTime,
      experience.endTime,
      experience.timePrecision,
    );
    if (to && to < today) {
      return {
        confidence: "past",
        phase: "finished",
        from,
        to,
        ...(line ? { line } : {}),
        because:
          from.slice(0, 4) < today.slice(0, 4)
            ? `The latest dates we have are from ${from.slice(0, 4)}. Nobody has listed it for this year yet.`
            : "These dates have already gone this season.",
      };
    }
    // A span Atlas could not break into days ("unexplained-span",
    // "separate-occurrences"): the window is real, the days inside it are not.
    if (experience.occurrence && !experience.occurrence.actionable) {
      return {
        confidence: "check",
        ...(from && to ? { phase: phaseOf(from, to, today) } : {}),
        from,
        to,
        ...(line ? { line } : {}),
        // Atlas's own `because` is written for engineers ("nothing Atlas
        // holds states this as a run…"); the card says what it means.
        because:
          "We have the dates it runs between, not which days or hours — check before you go.",
      };
    }
    // A "date range" of months is a listing that was never broken into
    // nights (a weekly DJ night "Dec 25, 2025 – Dec 25, 2026"). It is a
    // window, not a date Passport can stand behind: it does not go on the
    // calendar as a confirmed event.
    if (from && to && daysBetween(from, to) > MAX_CONFIRMED_SPAN) {
      return {
        confidence: "check",
        phase: phaseOf(from, to, today),
        from,
        to,
        ...(line ? { line } : {}),
        because:
          "This is listed across a very long window, not particular days — check the organiser's page for when it's actually on.",
      };
    }
    return {
      confidence: "dated",
      ...(from && to ? { phase: phaseOf(from, to, today) } : {}),
      from,
      to,
      ...(line ? { line } : {}),
      because: "Dates from the event's own listing.",
    };
  }
  if (published && namesOnlyEarlierYears(published, today))
    return {
      confidence: "past",
      line: published,
      because:
        "The organiser's words name an earlier year only. Nobody has said it's on this year.",
    };
  if (published)
    return {
      confidence: "check",
      line: published,
      because:
        "In the organiser's own words — Passport quotes it and doesn't read it as a schedule.",
    };
  return {
    confidence: "unconfirmed",
    because: "No dates for this season yet.",
  };
}

/**
 * Whether a find can happen inside the days somebody asked about. Only a
 * stated date range can say no; every other reading stays (unknown is not
 * closed — `CandidateAvailability`'s own rule), labelled.
 */
export function fitsDates(
  reading: WhenReading,
  from: string | undefined,
  to: string | undefined,
): boolean {
  if (!from && !to) return true;
  if (reading.confidence === "past") return false;
  if (!reading.from || !reading.to) return true;
  const start = from ?? to!;
  const end = to ?? from!;
  return reading.from <= end && reading.to >= start;
}

/** Calendar arithmetic on `YYYY-MM-DD` with no zone, which is what they are. */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysUntil(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) /
      86_400_000,
  );
}

export type SeasonStage = "coming" | "advent" | "christmas-week" | "after";

/**
 * Where we are in the season, for the page's opening line. Christmas Day of
 * the year whose season `today` belongs to (early January still belongs to
 * the Christmas just gone).
 */
export function season(today: string): {
  readonly stage: SeasonStage;
  readonly christmas: string;
  readonly daysToGo: number;
} {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const christmas = `${month === 1 ? year - 1 : year}-12-25`;
  const daysToGo = daysUntil(today, christmas);
  const stage: SeasonStage =
    daysToGo < 0
      ? "after"
      : daysToGo <= 7
        ? "christmas-week"
        : daysToGo <= 28
          ? "advent"
          : "coming";
  return { stage, christmas, daysToGo };
}

// ------------------------------------------------------------- when, asked

/**
 * **When, as a person says it** (owner brief "Christmas discovery UX
 * repair", 2026-11-22). A preset is kept as the word, not as the dates it
 * meant on the day it was tapped, so a "tonight" link opened tomorrow is
 * about tomorrow night — and the page can say _Tonight_ rather than a bare
 * date nobody remembers choosing.
 */
export type WhenChoice = "tonight" | "tomorrow" | "weekend";

export const WHEN_CHOICES: readonly {
  readonly value: WhenChoice;
  readonly label: string;
}[] = [
  { value: "tonight", label: "Tonight" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "weekend", label: "This weekend" },
];

export const isWhenChoice = (v: unknown): v is WhenChoice =>
  WHEN_CHOICES.some((c) => c.value === v);

const weekday = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay();

/** The days a preset means, from today (Vancouver's date). */
export function presetDates(
  when: WhenChoice,
  today: string,
): { readonly from: string; readonly to: string } {
  switch (when) {
    case "tonight":
      return { from: today, to: today };
    case "tomorrow":
      return { from: addDays(today, 1), to: addDays(today, 1) };
    case "weekend": {
      // Saturday or Sunday: the rest of this weekend; otherwise the next one.
      const d = weekday(today);
      if (d === 6) return { from: today, to: addDays(today, 1) };
      if (d === 0) return { from: today, to: today };
      const sat = addDays(today, 6 - d);
      return { from: sat, to: addDays(sat, 1) };
    }
  }
}

const SHORT = new Intl.DateTimeFormat("en-CA", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
/** "Sat, Nov 28" — a calendar day, no zone (it is one already). */
export const shortDay = (day: string) =>
  SHORT.format(new Date(`${day}T12:00:00Z`));

/**
 * What the WHEN control says: the preset's word, or the days themselves —
 * a single day that is today is "Tonight" however it was chosen.
 */
export function whenLabel(
  ask: {
    readonly when?: WhenChoice;
    readonly from?: string;
    readonly to?: string;
  },
  today: string,
): string {
  if (ask.when) return WHEN_CHOICES.find((c) => c.value === ask.when)!.label;
  if (!ask.from && !ask.to) return "Any date";
  const from = ask.from ?? ask.to!;
  const to = ask.to ?? from;
  if (from === to) {
    if (from === today) return "Tonight";
    if (from === addDays(today, 1)) return "Tomorrow";
    return shortDay(from);
  }
  return `${shortDay(from)} – ${shortDay(to)}`;
}
