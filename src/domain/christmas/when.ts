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

export type Confidence = "dated" | "check" | "unconfirmed" | "past";

export interface WhenReading {
  readonly confidence: Confidence;
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
  dated: "Dates from Atlas",
  check: "Check the days",
  unconfirmed: "Dates not confirmed",
  past: "Not listed this year",
};

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
        from,
        to,
        ...(line ? { line } : {}),
        because:
          from.slice(0, 4) < today.slice(0, 4)
            ? `The latest dates Atlas holds are from ${from.slice(0, 4)}. Nobody has listed it for this year yet.`
            : "These dates have already gone this season.",
      };
    }
    // A span Atlas could not break into days ("unexplained-span",
    // "separate-occurrences"): the window is real, the days inside it are not.
    if (experience.occurrence && !experience.occurrence.actionable) {
      return {
        confidence: "check",
        from,
        to,
        ...(line ? { line } : {}),
        // Atlas's own `because` is written for engineers ("nothing Atlas
        // holds states this as a run…"); the card says what it means.
        because:
          "Atlas has the dates it runs between, not which days or hours — check before you go.",
      };
    }
    return {
      confidence: "dated",
      from,
      to,
      ...(line ? { line } : {}),
      because: "Atlas holds these dates from the event's own listing.",
    };
  }
  if (published)
    return {
      confidence: "check",
      line: published,
      because:
        "In the organiser's own words — Passport quotes it and doesn't read it as a schedule.",
    };
  return {
    confidence: "unconfirmed",
    because: "Atlas doesn't hold dates for this season yet.",
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
