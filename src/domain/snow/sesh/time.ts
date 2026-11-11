/**
 * **The mountain's clock.** Championship periods are counted on the
 * resorts' own calendar (America/Vancouver), not the server's or the phone's,
 * so "today's champion" changes at midnight on the hill.
 *
 *   day     `2026-11-10`
 *   week    the Monday that starts it, `W2026-11-09`
 *   season  `2026/27` — 1 August to 31 July, so a whole winter is one season
 */
const ZONE = "America/Vancouver";
const fmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export type Period = "day" | "week" | "season" | "all";
export const PERIODS: readonly Period[] = ["day", "week", "season", "all"];
export const PERIOD_TITLE: Record<Period, string> = {
  day: "Today's Champion",
  week: "Weekly Champion",
  season: "Season Champion",
  all: "All-Time Legend",
};

/** `YYYY-MM-DD` on the hill. */
export function hillDay(iso: string | number | Date): string {
  return fmt.format(new Date(iso));
}

const utcOf = (ymd: string) =>
  Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10));
const ymdOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function hillWeek(iso: string | number | Date): string {
  const day = hillDay(iso);
  const ms = utcOf(day);
  const dow = (new Date(ms).getUTCDay() + 6) % 7; // Monday = 0
  return `W${ymdOf(ms - dow * 86_400_000)}`;
}

export function hillSeason(iso: string | number | Date): string {
  const day = hillDay(iso);
  const y = +day.slice(0, 4);
  const start = +day.slice(5, 7) >= 8 ? y : y - 1;
  return `${start}/${String((start + 1) % 100).padStart(2, "0")}`;
}

export function periodKey(period: Period, iso: string | number | Date): string {
  if (period === "day") return hillDay(iso);
  if (period === "week") return hillWeek(iso);
  if (period === "season") return hillSeason(iso);
  return "all";
}

/** "Mon 9 Nov" for a day key, "Week of 9 Nov" for a week key. */
export function periodWords(key: string): string {
  if (key === "all") return "All time";
  if (/^\d{4}\/\d{2}$/.test(key)) return `${key} season`;
  const week = key.startsWith("W");
  const ymd = week ? key.slice(1) : key;
  const d = new Date(utcOf(ymd));
  const day = d.toLocaleDateString("en-CA", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    ...(week ? {} : { weekday: "short" }),
  });
  return week ? `Week of ${day}` : day;
}

/** "3h 12m left", "12m left", "closing now". */
export function timeLeft(ms: number): string {
  if (ms <= 0) return "voting closed";
  const m = Math.ceil(ms / 60_000);
  if (m < 2) return "closing now";
  if (m < 60) return `${m}m left`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m left`;
}

/** "just now", "5m ago", "3h ago", "2d ago". */
export function ago(iso: string, now: number): string {
  const s = Math.max(0, (now - Date.parse(iso)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86_400)}d ago`;
}
