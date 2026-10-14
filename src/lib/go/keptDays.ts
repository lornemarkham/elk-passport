import { PART_OF_DAY_START, type PartOfDay } from "@/domain/day/intent";

/**
 * **Days a person chose to keep, on this device.**
 *
 * *Save is not the end* (doctrine §2.6): a day you can only build and never
 * keep cannot become a plan. This is the smallest honest version — the day's
 * `/go` address, the state a person shaped it into, and the print query, in
 * `localStorage`. Nothing is sent anywhere, and there is **no status field**:
 * what a kept day is called (wanted, planned, did…) is open (roadmap D-2) and
 * where it lives beyond one browser is open (D-9). When those are decided,
 * this is the thing that gets replaced, not extended.
 */
export const KEPT_DAYS_KEY = "ghad.kept-days";
export const MAX_KEPT_DAYS = 12;

export interface KeptDay {
  /** Stable per day: the print query, so keeping the same day twice is one day. */
  readonly id: string;
  readonly title: string;
  readonly stops: readonly string[];
  readonly keptAt: string;
  /** The `/go` address this day was built at. */
  readonly href: string;
  /** What `sessionStorage` held for it, so reopening restores the shaping. */
  readonly memoryKey: string;
  readonly shaped: string;
  /** The `/go/print` query. */
  readonly query: string;
}

const isKept = (v: unknown): v is KeptDay => {
  if (!v || typeof v !== "object") return false;
  const k = v as Record<string, unknown>;
  return (
    typeof k.id === "string" &&
    typeof k.title === "string" &&
    Array.isArray(k.stops) &&
    typeof k.keptAt === "string" &&
    typeof k.href === "string" &&
    k.href.startsWith("/go") &&
    typeof k.memoryKey === "string" &&
    typeof k.shaped === "string" &&
    typeof k.query === "string"
  );
};

export function decodeKeptDays(raw: string | null): readonly KeptDay[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter(isKept) : [];
  } catch {
    return [];
  }
}

export function readKeptDays(): readonly KeptDay[] {
  try {
    return decodeKeptDays(window.localStorage.getItem(KEPT_DAYS_KEY));
  } catch {
    return [];
  }
}

/** Newest first, the same day replaced rather than doubled, capped. */
export function withKept(
  all: readonly KeptDay[],
  day: KeptDay,
): readonly KeptDay[] {
  return [day, ...all.filter((d) => d.id !== day.id)].slice(0, MAX_KEPT_DAYS);
}

export function writeKeptDays(days: readonly KeptDay[]): boolean {
  try {
    window.localStorage.setItem(KEPT_DAYS_KEY, JSON.stringify(days));
    window.dispatchEvent(new Event("ghad-kept-days"));
    return true;
  } catch {
    return false;
  }
}

/**
 * A day built on *now* (`startsNow`) was counted from a clock that has moved
 * on. Reopened next week, "2:15 pm" would read as today's. The stops, order
 * and minutes the person shaped are kept; the borrowed clock is not.
 */
export function withoutStaleClock(shaped: string): string {
  try {
    const saved = JSON.parse(shaped) as {
      brief?: {
        startsNow?: boolean;
        startAt?: number;
        startFromWhen?: boolean;
        when?: PartOfDay;
      } | null;
    };
    if (saved.brief?.startsNow) {
      delete saved.brief.startsNow;
      delete saved.brief.startAt;
    }
    // "This afternoon" was never earlier than the clock it was said at; on
    // another day it is the afternoon's own start again.
    if (saved.brief?.startFromWhen && saved.brief.when) {
      const start = PART_OF_DAY_START[saved.brief.when];
      if (start !== undefined) saved.brief.startAt = start;
    }
    return JSON.stringify(saved);
  } catch {
    return shaped;
  }
}

/** Put a kept day back as this tab's shaped day, then go to its address. */
export function reopenKeptDay(day: KeptDay): void {
  try {
    window.sessionStorage.setItem(day.memoryKey, withoutStaleClock(day.shaped));
  } catch {
    // Without storage the day rebuilds from its address, unshaped.
  }
  window.location.assign(day.href);
}
