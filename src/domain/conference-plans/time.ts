/**
 * **Wall-clock times where the conference is.**
 *
 * People organise "Tuesday, 7:00 AM, hotel lobby" in the conference's own
 * time zone, wherever their phone thinks it is. Plans store each occurrence
 * as a UTC instant and are typed and read back in the conference's zone.
 */

const parts = (timeZone: string, at: Date) => {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const p = Object.fromEntries(
    f.formatToParts(at).map((x) => [x.type, x.value]),
  ) as Record<string, string>;
  return {
    ymd: `${p.year}-${p.month}-${p.day}`,
    hm: `${p.hour}:${p.minute}`,
  };
};

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const HM = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * `2026-10-27` + `07:00` in `America/Vancouver` → the UTC instant, or `null`
 * for something that isn't a date and time. A time that doesn't exist (the
 * hour skipped when clocks go forward) lands on the next real minute.
 */
export function zonedToUtc(
  ymd: string,
  hm: string,
  timeZone: string,
): Date | null {
  if (!YMD.test(ymd) || !HM.test(hm)) return null;
  const guess = Date.parse(`${ymd}T${hm}:00Z`);
  if (Number.isNaN(guess)) return null;
  // Two passes: the zone's offset at the guess, then at the corrected instant.
  let t = guess;
  for (let i = 0; i < 2; i++) {
    const seen = parts(timeZone, new Date(t));
    const seenMs = Date.parse(`${seen.ymd}T${seen.hm}:00Z`);
    t += guess - seenMs;
  }
  return new Date(t);
}

/** The conference-zone date and time of an instant. */
export function utcToZoned(
  at: Date,
  timeZone: string,
): { ymd: string; hm: string } {
  return parts(timeZone, at);
}

/** "Tuesday" */
export function weekday(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, weekday: "long" }).format(
    at,
  );
}

/** "7:00 AM" */
export function clock(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(at);
}

/** "Tue, Oct 27" */
export function shortDay(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(at);
}

/** "Today", "Tomorrow", or "Tuesday, Oct 27", from where the conference is. */
export function dayWords(at: Date, timeZone: string, now: Date): string {
  const day = (d: Date) => Date.parse(`${parts(timeZone, d).ymd}T00:00:00Z`);
  const diff = Math.round((day(at) - day(now)) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(at);
}

/** "in 25 min", "in 2 h 10 min", "started 5 min ago". */
export function untilWords(at: Date, now: Date): string {
  const min = Math.round((at.getTime() - now.getTime()) / 60_000);
  if (min === 0) return "now";
  const abs = Math.abs(min);
  const span =
    abs < 60
      ? `${abs} min`
      : `${Math.floor(abs / 60)} h${abs % 60 ? ` ${abs % 60} min` : ""}`;
  return min > 0 ? `in ${span}` : `started ${span} ago`;
}
