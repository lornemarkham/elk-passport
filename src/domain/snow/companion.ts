/**
 * **The day-of companion's small decisions, kept out of the screen.**
 *
 * What a crew says to each other on the hill is a handful of short, kind
 * sentences. They are built here so they can be tested, and so none of them
 * can ever encourage speed, risk or a rule being broken.
 */
export const LUNCH_TIMES = ["11:30", "12:00", "12:30", "1:00"] as const;

export const QUICK_UPDATES = [
  "Heading to the lodge for a food break",
  "Back on the hill — meet at the lift base in 20",
  "Last run! Everyone down together",
  "Heading to the car",
] as const;

/** Who hears a short update: a shared day's chat, or a one-phone day's notes. */
export type Channel = "chat" | "announce";
export const channelFor = (shared: boolean): Channel =>
  shared ? "chat" : "announce";

export function lunchLine(time: string, place: string | undefined): string {
  return place
    ? `Lunch at ${time} — ${place}. Meet there.`
    : `Lunch at ${time}. Where? Vote in the plan.`;
}

/** "3:45 pm" from a Date, in the phone's own time zone. */
export function clock(d: Date): string {
  return d
    .toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" })
    .replace(/\s?([ap])\.?m\.?/i, " $1m");
}

export const LEAVE_IN_MINUTES = [15, 30, 60] as const;

export function leaveLine(now: Date, minutes: number): string {
  const at = new Date(now.getTime() + minutes * 60_000);
  return `Heading down — leaving the hill around ${clock(at)}. Say if you need longer.`;
}

/** How long a day has been on, for the header: "2 h 10 min". */
export function elapsed(startIso: string, now: Date): string {
  const min = Math.max(
    0,
    Math.floor((now.getTime() - Date.parse(startIso)) / 60_000),
  );
  const h = Math.floor(min / 60);
  return h > 0
    ? `${h} h ${String(min % 60).padStart(2, "0")} min`
    : `${min} min`;
}

export interface Started {
  readonly startedAt: string;
  readonly endedAt?: string;
}

export const startedKey = (dayId: string) => `passport.snow.started.${dayId}`;

export function parseStarted(raw: string | null): Started | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    const ok = (s: unknown): s is string =>
      typeof s === "string" && !Number.isNaN(Date.parse(s));
    if (!ok(v.startedAt)) return null;
    return ok(v.endedAt)
      ? { startedAt: v.startedAt, endedAt: v.endedAt }
      : { startedAt: v.startedAt };
  } catch {
    return null;
  }
}
