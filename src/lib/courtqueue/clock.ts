import { legalOffset } from "@/domain/date-night/conditions";

/**
 * The server's clock. A rehearsal on the memory store can set
 * `COURTQUEUE_CLOCK` (an ISO time) to start the clock there — so the e2e
 * suite can play a Thursday night on any day of the week. Never honoured
 * with a real database — except a throwaway one on this machine (the Supabase
 * URL is loopback), which is how the 25-phone rehearsal runs on Postgres.
 */
const localDatabase = () =>
  /^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  );

export function serverNow(): number {
  const at = process.env.COURTQUEUE_CLOCK;
  if (!at || (process.env.COURTQUEUE_STORE !== "memory" && !localDatabase()))
    return Date.now();
  const g = globalThis as unknown as {
    __cqClock?: { from: number; at: number };
  };
  const start = Date.parse(at);
  if (Number.isNaN(start)) return Date.now();
  g.__cqClock ??= { from: Date.now(), at: start };
  return g.__cqClock.at + (Date.now() - g.__cqClock.from);
}

/** Badminton is played in British Columbia. */
export const ZONE = "America/Vancouver";

const local = (at: number) =>
  new Date(at + legalOffset(new Date(at), ZONE) * 60_000);

/** YYYY-MM-DD on the wall in Vancouver. */
export function localDate(at: number): string {
  return local(at).toISOString().slice(0, 10);
}

/** 0 = Sunday, on the wall in Vancouver. */
export function localWeekday(at: number): number {
  return local(at).getUTCDay();
}

/** "7:42 pm" on the wall in Vancouver. */
export function localClock(at: number): string {
  const d = local(at);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

/** The instant "HH:MM" falls on, on `date`, in Vancouver. */
export function instantOn(date: string, hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  const [y, mo, d] = date.split("-").map(Number);
  const guess = Date.UTC(y!, mo! - 1, d!, h, min);
  const first = guess - legalOffset(new Date(guess), ZONE) * 60_000;
  return guess - legalOffset(new Date(first), ZONE) * 60_000;
}

/** The next Monday and Thursday from today (today included), in Vancouver. */
export function nextSessionDates(now: number, count = 2): string[] {
  const out: string[] = [];
  for (let i = 0; out.length < count && i < 14; i++) {
    const at = now + i * 86_400_000;
    const wd = localWeekday(at);
    if (wd === 1 || wd === 4) out.push(localDate(at));
  }
  return out;
}

export function weekdayLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const wd = new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
  const name = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ][wd]!;
  const month = new Date(Date.UTC(y!, m! - 1, d!)).toLocaleString("en-CA", {
    month: "short",
    timeZone: "UTC",
  });
  return `${name} ${month} ${d}`;
}

/** "19:42" on the wall in Vancouver — what the organizer's time box takes. */
export function localHHMM(at: number): string {
  return local(at).toISOString().slice(11, 16);
}
