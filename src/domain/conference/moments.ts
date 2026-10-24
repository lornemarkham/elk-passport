import { utcToZoned } from "@/domain/conference-plans/time";
import { effectiveEnd, type DayEntry } from "./agenda";
import { countdown } from "./countdown";
import type { ConferenceDetails, ConferenceKind } from "./types";

/**
 * **The little moments: what the day feels like, said once.**
 *
 * Everything here reads the published agenda and the clock; nothing is
 * announced that the organiser didn't publish. The lines are Passport's
 * own voice — a greeting, a nudge — never presented as the organiser's,
 * and at most one shows on a screen (doctrine §6: restraint is the point).
 */

const hourIn = (timeZone: string, now: Date) =>
  Number(utcToZoned(now, timeZone).hm.slice(0, 2));

/** "Good morning, Vancouver." From the clock where the conference is. */
export function greeting(city: string, timeZone: string, now: Date): string {
  const h = hourIn(timeZone, now);
  if (h < 5) return `Still up, ${city}?`;
  if (h < 12) return `Good morning, ${city}`;
  if (h < 17) return `Good afternoon, ${city}`;
  return `Good evening, ${city}`;
}

const kindOf = (e: DayEntry) => e.kind ?? "session";
const isProgramme = (e: DayEntry) =>
  e.source === "agenda" && (kindOf(e) === "session" || kindOf(e) === "skills");

/**
 * One line for Home, or none. In order of precedence: the celebration
 * tonight; a social line on now or next; the first morning of sessions;
 * afterwards, the send-off.
 */
export function momentFor(input: {
  readonly kind: ConferenceKind;
  readonly details: Pick<ConferenceDetails, "startsOn" | "endsOn" | "timeZone">;
  readonly today: readonly DayEntry[];
  /** Every published day, in order, for "the first day of sessions". */
  readonly firstProgrammeDay: string | null;
  readonly ymd: string;
  readonly now: Date;
}): string | null {
  const { details, today, now, ymd } = input;
  const c = countdown(details as ConferenceDetails, now);
  if (c.phase === "after") {
    const days =
      (Date.parse(`${details.endsOn ?? details.startsOn}T00:00:00Z`) -
        Date.parse(`${details.startsOn}T00:00:00Z`)) /
        86_400_000 +
      1;
    const n = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven"][days];
    return days > 1
      ? `${n ?? days} days. A lot of conversations. Let's keep the good stuff going.`
      : "A lot of conversations. Let's keep the good stuff going.";
  }
  if (c.phase !== "during") return null;
  const t = now.getTime();
  const ahead = today.filter(
    (e) => e.source === "agenda" && effectiveEnd(e, today).getTime() > t,
  );
  const celebration = ahead.find(
    (e) => kindOf(e) === "celebration" && Date.parse(e.startsAt) > t,
  );
  if (
    celebration &&
    hourIn(details.timeZone, new Date(celebration.startsAt)) >= 17
  )
    return "Tonight, we celebrate.";
  const soon = ahead.slice(0, 2);
  if (soon.some((e) => kindOf(e) === "social" && !e.aside))
    return "Your mission: meet someone new.";
  if (
    input.kind === "conference" &&
    ymd === input.firstProgrammeDay &&
    hourIn(details.timeZone, now) < 12
  )
    return "Time to meet the people behind the Slack avatars.";
  return null;
}

/** The first day on which a session (not a meal, a break or a social) is published. */
export function firstProgrammeDay(
  days: readonly { ymd: string; entries: readonly DayEntry[] }[],
): string | null {
  return days.find((d) => d.entries.some(isProgramme))?.ymd ?? null;
}

export type FreeTime =
  | {
      readonly kind: "gap";
      /** Whole minutes until the next thing the person should be at. */
      readonly minutes: number;
      readonly until: DayEntry;
      /** What's on now, when it's a break or a meal. */
      readonly during: DayEntry | null;
    }
  | { readonly kind: "evening"; readonly since: DayEntry };

/**
 * **"You have 30 minutes."** Free time is what the published agenda leaves:
 * a break on now, or nothing on now with the next line still ahead, measured
 * to the next line that isn't itself a break. After the day's last line has
 * run (its typed end, else the display rule) and before eleven, the evening
 * is free. Nothing else counts — a session is never "free time".
 */
export function freeTime(
  today: readonly DayEntry[],
  timeZone: string,
  now: Date,
): FreeTime | null {
  const agenda = today.filter((e) => e.source === "agenda");
  if (!agenda.length) return null;
  const t = now.getTime();
  const current = agenda.filter(
    (e) => Date.parse(e.startsAt) <= t && effectiveEnd(e, agenda).getTime() > t,
  );
  const busy = current.some(
    (e) => kindOf(e) !== "break" && kindOf(e) !== "travel",
  );
  const next = agenda.find(
    (e) => Date.parse(e.startsAt) > t && kindOf(e) !== "break",
  );
  if (!busy && next) {
    const minutes = Math.floor((Date.parse(next.startsAt) - t) / 60_000);
    if (minutes < 10) return null;
    // Before the day's first line, "free time" is just the morning.
    if (!agenda.some((e) => Date.parse(e.startsAt) <= t)) return null;
    return {
      kind: "gap",
      minutes,
      until: next,
      during: current.find((e) => kindOf(e) === "break") ?? null,
    };
  }
  const last = agenda[agenda.length - 1]!;
  if (
    !busy &&
    !next &&
    effectiveEnd(last, agenda).getTime() <= t &&
    hourIn(timeZone, now) < 23 &&
    kindOf(last) !== "travel"
  )
    return { kind: "evening", since: last };
  return null;
}

/**
 * How far a place may be, on foot, to fit a gap: there and back, plus five
 * minutes to order. `null` when the gap doesn't allow a walk at all.
 */
export const walkBudget = (minutes: number): number | null => {
  const each = Math.floor((minutes - 5) / 2);
  return each >= 3 ? Math.min(each, 20) : null;
};

/**
 * What's on tonight: the first published evening line today — a meal, a
 * social or the celebration from 5 p.m., or anything from 6 p.m. — that
 * hasn't finished, or `null`. A 5 p.m. wrap-up is not "tonight".
 */
export function tonight(
  today: readonly DayEntry[],
  timeZone: string,
  now: Date,
): DayEntry | null {
  const t = now.getTime();
  const evening = (e: DayEntry) => {
    const h = hourIn(timeZone, new Date(e.startsAt));
    const k = kindOf(e);
    return (
      h >= 18 ||
      (h >= 17 && (k === "meal" || k === "social" || k === "celebration"))
    );
  };
  return (
    today.find(
      (e) =>
        e.source === "agenda" &&
        evening(e) &&
        effectiveEnd(e, today).getTime() > t,
    ) ?? null
  );
}

/** "Starts in 12 minutes", "Starts in 1 h 5 min", "Started 10 minutes ago". */
export function startsWords(at: Date, now: Date): string {
  const min = Math.round((at.getTime() - now.getTime()) / 60_000);
  if (min === 0) return "Starting now";
  const abs = Math.abs(min);
  const span =
    abs < 60
      ? `${abs} minute${abs === 1 ? "" : "s"}`
      : `${Math.floor(abs / 60)} h${abs % 60 ? ` ${abs % 60} min` : ""}`;
  return min > 0 ? `Starts in ${span}` : `Started ${span} ago`;
}
