import { instantOn, localDate, weekdayLabel } from "./clock";

/**
 * **The club's season.** Vernon Badminton Club plays at Coldstream
 * Elementary School Gym, Mondays 7:00–9:00 pm and Thursdays 6:30–8:30 pm,
 * from October 5, 2026 to April 15, 2027 (owner brief, _P0: CourtQueue
 * real-world release_). Every date here is on the wall in Vancouver.
 *
 * A night is open for sign-up **only on its own day, from 8:00 am** until it
 * ends — nobody reserves a future night — and never on a cancelled date.
 * The server enforces this (`engine.ts`); the phone only explains it.
 */

export const SEASON = {
  club: "Vernon Badminton Club",
  venue: "Coldstream Elementary School Gym",
  first: "2026-10-05",
  last: "2027-04-15",
  /** Weekday (0 = Sunday) → the hours on the gym booking. */
  nights: {
    1: { start: "19:00", end: "21:00" },
    4: { start: "18:30", end: "20:30" },
  } as Record<number, { start: string; end: string }>,
  registrationOpens: "08:00",
} as const;

/**
 * **The crossed-out dates on the official schedule.** The owner's printed
 * schedule was not available to the mission that built this (it was not in
 * the brief, the inbox or the repository), so none are typed in here rather
 * than guessed. Organizers enter them from their phone — Organize →
 * Schedule — where each cancellation is kept with who made it and why, and
 * the schedule shows a reminder until an organizer confirms it matches the
 * official sheet. Dates added here are cancelled for everyone, always.
 */
export const OFFICIAL_CANCELLED: Readonly<Record<string, string>> = {};

export interface Cancellation {
  readonly reason: string;
  readonly by: string;
  readonly at: number;
}

export type Cancellations = Readonly<Record<string, Cancellation>>;

export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
}

export const isDate = (d: unknown): d is string =>
  typeof d === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(d) &&
  !Number.isNaN(Date.parse(`${d}T12:00:00Z`));

/** A Monday or Thursday inside the season. */
export function isScheduled(date: string): boolean {
  return (
    date >= SEASON.first &&
    date <= SEASON.last &&
    SEASON.nights[weekdayOf(date)] !== undefined
  );
}

/** Every night on the season's calendar, cancelled ones included. */
export function seasonDates(): string[] {
  const out: string[] = [];
  const [y, m, d] = SEASON.first.split("-").map(Number);
  for (let t = Date.UTC(y!, m! - 1, d!); ; t += 86_400_000) {
    const date = new Date(t).toISOString().slice(0, 10);
    if (date > SEASON.last) break;
    if (isScheduled(date)) out.push(date);
  }
  return out;
}

export function cancellationOf(
  date: string,
  club: Cancellations | undefined,
): { reason: string; official: boolean } | null {
  const official = OFFICIAL_CANCELLED[date];
  if (official !== undefined) return { reason: official, official: true };
  const c = club?.[date];
  return c ? { reason: c.reason, official: false } : null;
}

/** When a night starts and ends, as instants. */
export function sessionWindow(date: string): { start: number; end: number } {
  const hours = SEASON.nights[weekdayOf(date)] ?? {
    start: "19:00",
    end: "21:00",
  };
  return {
    start: instantOn(date, hours.start)!,
    end: instantOn(date, hours.end)!,
  };
}

export const registrationOpensAt = (date: string) =>
  instantOn(date, SEASON.registrationOpens)!;

/**
 * A night is over for good this long after its booked end: the queue is put
 * away and tomorrow starts empty. Games still on court are finished at that
 * moment and marked estimated.
 */
export const WIND_DOWN_MS = 60 * 60_000;

export type RegistrationState =
  "cancelled" | "off-season" | "not-yet" | "open" | "over";

export function registrationState(
  date: string,
  now: number,
  club: Cancellations | undefined,
): RegistrationState {
  if (!isScheduled(date)) return "off-season";
  if (cancellationOf(date, club)) return "cancelled";
  if (now < registrationOpensAt(date)) return "not-yet";
  if (now > sessionWindow(date).end) return "over";
  return "open";
}

/** Plain words for why sign-up is or isn't possible, for refusals and cards. */
export function registrationWords(
  date: string,
  now: number,
  club: Cancellations | undefined,
): string {
  switch (registrationState(date, now, club)) {
    case "cancelled":
      return `${weekdayLabel(date)} is cancelled — no badminton that night.`;
    case "off-season":
      return `There's no club night on ${weekdayLabel(date)}.`;
    case "not-yet":
      return localDate(now) === date
        ? "Sign-up opens at 8:00 am today."
        : `Sign-up opens at 8:00 am on ${weekdayLabel(date)}.`;
    case "over":
      return `${weekdayLabel(date)} is over.`;
    case "open":
      return "Sign-up is open.";
  }
}

/**
 * The scheduled, not-cancelled nights from today on (today included while it
 * hasn't ended), soonest first.
 */
export function upcomingNights(
  now: number,
  club: Cancellations | undefined,
  count = 2,
): string[] {
  const today = localDate(now);
  return seasonDates()
    .filter(
      (d) =>
        d >= today &&
        !cancellationOf(d, club) &&
        now <= sessionWindow(d).end + WIND_DOWN_MS,
    )
    .slice(0, count);
}

/** "Mon 7:00–9:00 pm" for a date. */
export function hoursLabel(date: string): string {
  const h = SEASON.nights[weekdayOf(date)];
  if (!h) return "";
  const fmt = (hhmm: string) => {
    const [hh, mm] = hhmm.split(":").map(Number);
    return `${hh! % 12 === 0 ? 12 : hh! % 12}:${String(mm).padStart(2, "0")}`;
  };
  return `${fmt(h.start)}–${fmt(h.end)} pm`;
}
