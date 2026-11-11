import { SEASON, registrationOpensAt, weekdayOf } from "./schedule";

/**
 * **"Registration opens in 11h 42m."** What a phone says about a night's
 * sign-up, from the night's own date and the club's 8:00 am opening — never
 * a hardcoded time. Within the twelve hours before sign-up opens it counts
 * down; before that it names the day and the time; once open it says so.
 * Nobody is signed up when it reaches zero: it is words, not an action.
 */

/** The countdown starts this long before sign-up opens. */
export const COUNTDOWN_MS = 12 * 60 * 60_000;

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "Thursday, November 12". */
export function longDate(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${WEEKDAYS[weekdayOf(date)]}, ${MONTHS[m! - 1]} ${d}`;
}

/** "8:00 a.m." — the club's opening time, as people write it. */
export function openingWords(hhmm: string = SEASON.registrationOpens): string {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h! % 12 === 0 ? 12 : h! % 12}:${String(m).padStart(2, "0")} ${h! < 12 ? "a.m." : "p.m."}`;
}

/** "11h 42m", "42m", "under a minute" — rounded up, so it never says 0m early. */
export function untilWords(ms: number): string {
  if (ms < 60_000) return "under a minute";
  const minutes = Math.ceil(ms / 60_000);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

export type CountdownState = "scheduled" | "counting" | "open";

export interface Countdown {
  readonly state: CountdownState;
  readonly opensAt: number;
  /** Milliseconds until sign-up opens; 0 once it has. */
  readonly msLeft: number;
  /** "Registration opens in 11h 42m" / "Registration opens Thursday, November 12 at 8:00 a.m." / "Registration is open!" */
  readonly headline: string;
  /** "Thursday, November 12". */
  readonly day: string;
  /** "Opens Thursday at 8:00 a.m." */
  readonly opens: string;
}

/**
 * Sign-up for `date`, as seen at `now`. Only about the clock: whether the
 * night is cancelled, over or full is the caller's to say.
 */
export function registrationCountdown(date: string, now: number): Countdown {
  const opensAt = registrationOpensAt(date);
  const msLeft = Math.max(0, opensAt - now);
  const day = longDate(date);
  const at = openingWords();
  const opens = `Opens ${WEEKDAYS[weekdayOf(date)]} at ${at}`;
  if (msLeft === 0)
    return {
      state: "open",
      opensAt,
      msLeft,
      headline: "Registration is open!",
      day,
      opens,
    };
  if (msLeft <= COUNTDOWN_MS)
    return {
      state: "counting",
      opensAt,
      msLeft,
      headline: `Registration opens in ${untilWords(msLeft)}`,
      day,
      opens,
    };
  return {
    state: "scheduled",
    opensAt,
    msLeft,
    headline: `Registration opens ${day} at ${at}`,
    day,
    opens,
  };
}

/** "13 of 25 spaces left" / "Full — join the waitlist". */
export function spacesWords(confirmed: number, capacity: number): string {
  const left = Math.max(0, capacity - confirmed);
  return left === 0
    ? `Full — all ${capacity} spaces taken`
    : `${left} of ${capacity} spaces left`;
}
