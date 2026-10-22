/**
 * **Time to puck drop, as a scoreboard says it.**
 *
 * Whole units only, rounded down — a clock that says "1 hour" at 1h59m
 * would be lying by most of an hour. Seconds appear only in the last hour,
 * when they are the interesting part; days appear only while there are any.
 */
export interface Countdown {
  readonly past: boolean;
  readonly days: number;
  readonly hours: number;
  readonly minutes: number;
  readonly seconds: number;
  /** The units worth showing right now, biggest first. */
  readonly units: readonly { readonly value: string; readonly unit: string }[];
}

const pad = (n: number) => String(n).padStart(2, "0");

export function countdown(now: Date, anchor: Date): Countdown {
  const ms = anchor.getTime() - now.getTime();
  const past = ms <= 0;
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  const seconds = total % 60;

  const units =
    days > 0
      ? [
          { value: String(days), unit: days === 1 ? "day" : "days" },
          { value: pad(hours), unit: "hrs" },
          { value: pad(minutes), unit: "min" },
        ]
      : hours > 0
        ? [
            { value: String(hours), unit: hours === 1 ? "hr" : "hrs" },
            { value: pad(minutes), unit: "min" },
          ]
        : [
            { value: pad(minutes), unit: "min" },
            { value: pad(seconds), unit: "sec" },
          ];

  return { past, days, hours, minutes, seconds, units };
}

/** "Sun, Oct 25 · 7:00 p.m." in the arena's own time zone. */
export function gameWhen(anchor: Date, timeZone = "America/Vancouver"): string {
  const day = anchor.toLocaleDateString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone,
  });
  const time = anchor.toLocaleTimeString("en-CA", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
  return `${day} · ${time}`;
}

/** A clock time relative to the anchor, e.g. the meeting time "5:30 p.m.". */
export function clockAt(
  anchor: Date,
  offsetMinutes: number,
  timeZone = "America/Vancouver",
): string {
  return new Date(anchor.getTime() + offsetMinutes * 60_000).toLocaleTimeString(
    "en-CA",
    { hour: "numeric", minute: "2-digit", timeZone },
  );
}
