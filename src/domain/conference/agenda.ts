import { utcToZoned, zonedToUtc } from "@/domain/conference-plans/time";
import type { PlanView } from "@/domain/conference-plans/views";
import { countdown, todayIn } from "./countdown";
import type { AgendaItem, AgendaKind, ConferenceDetails } from "./types";

/**
 * **The day, read as a participant asks it: what's on now, what's next, and
 * where should I be?**
 *
 * Two sources and no third. The organiser's published agenda (the sessions,
 * the reception, the hockey game) and the plans colleagues made together
 * (the morning walk, the team dinner). They are kept apart on screen —
 * a session somebody published is not a dinner somebody suggested — and
 * read together here, because "what's next" is one question.
 *
 * Nothing is inferred. A line with no end runs until the next published
 * line, or for an hour when it is the last; that is a display rule, said
 * on screen as "until …" only when the organiser typed an end.
 */

export interface DayEntry {
  readonly source: "agenda" | "plan";
  readonly id: string;
  readonly title: string;
  /** UTC instant. */
  readonly startsAt: string;
  /** UTC instant the organiser typed, or `null`. */
  readonly endsAt: string | null;
  readonly where: string | null;
  readonly note: string | null;
  readonly featured: boolean;
  /** For published lines: what sort of line (absent reads as a session). */
  readonly kind?: AgendaKind;
  readonly topics?: readonly string[];
  readonly aside?: string;
  /** For plans: who's coming, as the plan view counts it. */
  readonly going?: number;
  /** For plans: your answer for this occurrence. */
  readonly mine?: "in" | "maybe" | "out" | null;
  /** For plans: the plan's emoji-free kind label ("Dinner"). */
  readonly kindLabel?: string;
  /** For plans: the occurrence this entry is. */
  readonly occurrenceId?: string;
}

/**
 * Plans as day entries: every occurrence a person can still see. Where we
 * meet is the meeting point, or — when the group chose a place and nobody
 * typed one — the place itself.
 */
export function planEntries(plans: readonly PlanView[]): DayEntry[] {
  return plans.flatMap((p) =>
    p.occurrences.map((o): DayEntry => ({
      source: "plan",
      id: p.id,
      occurrenceId: o.id,
      title: p.title,
      startsAt: o.startsAt,
      endsAt: null,
      where: p.meeting?.label ?? p.venue?.name ?? null,
      note: null,
      featured: false,
      going: o.counts.in,
      mine: o.mine,
      kindLabel: p.kindLabel,
    })),
  );
}

/** Every calendar day of the conference, in its own zone. */
export function conferenceDays(
  details: Pick<ConferenceDetails, "startsOn" | "endsOn">,
): string[] {
  const out: string[] = [];
  const end = details.endsOn ?? details.startsOn;
  for (
    let t = Date.parse(`${details.startsOn}T12:00:00Z`);
    t <= Date.parse(`${end}T12:00:00Z`) && out.length < 31;
    t += 86_400_000
  )
    out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

/** The days the agenda covers: the conference's, plus any early or late line. */
export function agendaDays(
  details: Pick<ConferenceDetails, "startsOn" | "endsOn" | "agenda">,
): string[] {
  const days = new Set(conferenceDays(details));
  for (const i of details.agenda ?? []) days.add(i.day);
  return [...days].sort();
}

export function agendaEntry(item: AgendaItem, timeZone: string): DayEntry {
  const start = zonedToUtc(item.day, item.start, timeZone)!;
  const end = item.end ? zonedToUtc(item.day, item.end, timeZone) : null;
  return {
    source: "agenda",
    id: item.id,
    title: item.title,
    startsAt: start.toISOString(),
    endsAt: end ? end.toISOString() : null,
    where: item.where ?? null,
    note: item.note ?? null,
    featured: item.featured === true,
    kind: item.kind ?? "session",
    ...(item.topics?.length ? { topics: item.topics } : {}),
    ...(item.aside ? { aside: item.aside } : {}),
  };
}

/** The agenda's own heading for a day, when it gives one. */
export const dayTitleFor = (
  details: Pick<ConferenceDetails, "dayTitles">,
  ymd: string,
): string | null =>
  details.dayTitles?.find((t) => t.day === ymd)?.title ?? null;

/** One day's entries, agenda and plans together, in time order. */
export function dayEntries(
  details: Pick<ConferenceDetails, "agenda" | "timeZone">,
  ymd: string,
  plans: readonly DayEntry[] = [],
): DayEntry[] {
  const tz = details.timeZone;
  const agenda = (details.agenda ?? [])
    .filter((i) => i.day === ymd)
    .map((i) => agendaEntry(i, tz));
  const theirs = plans.filter(
    (p) => utcToZoned(new Date(p.startsAt), tz).ymd === ymd,
  );
  return [...agenda, ...theirs].sort(
    (a, b) =>
      a.startsAt.localeCompare(b.startsAt) ||
      // A published line before a plan at the same minute.
      (a.source === b.source ? 0 : a.source === "agenda" ? -1 : 1),
  );
}

const HOUR = 3_600_000;

/**
 * When an entry stops counting as "now": its typed end, else the next
 * published line's start (plans don't end sessions), else an hour.
 */
export function effectiveEnd(entry: DayEntry, day: readonly DayEntry[]): Date {
  if (entry.endsAt) return new Date(entry.endsAt);
  const start = Date.parse(entry.startsAt);
  const next = day.find(
    (e) =>
      e.source === "agenda" &&
      entry.source === "agenda" &&
      Date.parse(e.startsAt) > start,
  );
  return new Date(next ? Date.parse(next.startsAt) : start + HOUR);
}

export interface NowAndNext {
  /** Everything happening at this minute (a session, and maybe a plan). */
  readonly now: readonly DayEntry[];
  /** The next thing to start today, if any. */
  readonly next: DayEntry | null;
  /** What's left after `next`, today. */
  readonly later: readonly DayEntry[];
  /** Done today. */
  readonly done: readonly DayEntry[];
}

export function nowAndNext(day: readonly DayEntry[], now: Date): NowAndNext {
  const t = now.getTime();
  const current: DayEntry[] = [];
  const upcoming: DayEntry[] = [];
  const done: DayEntry[] = [];
  for (const e of day) {
    const start = Date.parse(e.startsAt);
    if (start > t) upcoming.push(e);
    else if (effectiveEnd(e, day).getTime() > t) current.push(e);
    else done.push(e);
  }
  return {
    now: current,
    next: upcoming[0] ?? null,
    later: upcoming.slice(1),
    done,
  };
}

/**
 * **Where the participant is in their journey.** Decides what the overview
 * leads with; it never hides anything, only orders it.
 *
 * - `before`: travel, arrivals, the agenda to come.
 * - `arrival`: before day one, when people land today or it's the eve of
 *   day one. Who has landed, where to go.
 * - `during`: today's agenda, where to be, this evening's plans.
 * - `after`: what we did, and what to keep.
 */
export type JourneyPhase = "before" | "arrival" | "during" | "after";

export function journeyPhase(
  details: Pick<ConferenceDetails, "startsOn" | "endsOn" | "timeZone">,
  now: Date,
  landingsToday: number,
): JourneyPhase {
  const c = countdown(details as ConferenceDetails, now);
  if (c.phase === "after") return "after";
  if (c.phase === "before")
    return c.days === 1 || landingsToday > 0 ? "arrival" : "before";
  // Once the conference is running the day leads; today's landings still
  // show, beside it.
  return "during";
}

export const today = (
  details: Pick<ConferenceDetails, "timeZone">,
  now: Date,
) => todayIn(details.timeZone, now);
