/**
 * **The adventure before, during and after** — pure, so the wording and the
 * arithmetic are pinned by tests rather than discovered in a browser.
 *
 * Everything here is derived from what the adventure already holds (its
 * dates, stops, the builder's own `StopDetail`) or from what the person did
 * on their own phone. Nothing is invented: no weather, no availability, no
 * reservation, no travel time (doctrine §2.3).
 *
 * A person's memories stay on their device unless they choose to share one
 * with the group (ADR 014: personal memories remain private).
 */

import type { StopDetail } from "./propose";

const DAY_MS = 86_400_000;

/** Whole calendar days from `today` to `day` (both `YYYY-MM-DD`). */
export function daysUntil(day: string, today: string): number {
  return Math.round(
    (Date.parse(`${day}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) /
      DAY_MS,
  );
}

export interface Countdown {
  readonly days: number;
  /** The big word: "3", "Tomorrow". */
  readonly big: string;
  /** The line under it: "days to go". */
  readonly small: string;
}

/** Counting down to a date that has not arrived; `null` once it has. */
export function countdown(
  startsOn: string | null,
  today: string,
): Countdown | null {
  if (!startsOn) return null;
  const days = daysUntil(startsOn, today);
  if (days <= 0) return null;
  if (days === 1) return { days, big: "Tomorrow", small: "is the day" };
  return { days, big: String(days), small: "days to go" };
}

// ---------------------------------------------------------------------------
// What the person keeps on their own phone

export type MemoryKind = "note" | "photo" | "favourite";

export interface Memory {
  readonly id: string;
  readonly kind: MemoryKind;
  /** ISO moment it was captured. */
  readonly at: string;
  /** The adventure item it is about, when it is about one. */
  readonly itemId: string | null;
  readonly text: string | null;
  /** A JPEG data URL, shrunk in the browser before it is kept. */
  readonly photo: string | null;
}

export const NOTE_LIMIT = 1000;

const KINDS: readonly MemoryKind[] = ["note", "photo", "favourite"];

/** Read what is stored; anything malformed is dropped, never thrown. */
export function parseMemories(raw: string | null): readonly Memory[] {
  if (!raw) return [];
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(value)) return [];
  return value.flatMap((m): Memory[] => {
    if (!m || typeof m !== "object") return [];
    const r = m as Record<string, unknown>;
    if (typeof r["id"] !== "string" || typeof r["at"] !== "string") return [];
    if (!KINDS.includes(r["kind"] as MemoryKind)) return [];
    const text = typeof r["text"] === "string" ? r["text"] : null;
    const photo = typeof r["photo"] === "string" ? r["photo"] : null;
    if (r["kind"] === "photo" && !photo) return [];
    if (r["kind"] === "note" && !text?.trim()) return [];
    return [
      {
        id: r["id"],
        kind: r["kind"] as MemoryKind,
        at: r["at"],
        itemId: typeof r["itemId"] === "string" ? r["itemId"] : null,
        text: text ? text.slice(0, NOTE_LIMIT) : null,
        photo,
      },
    ];
  });
}

/** A favourite is a toggle per stop: adding a second removes the first. */
export function withMemory(
  list: readonly Memory[],
  memory: Memory,
): readonly Memory[] {
  if (memory.kind === "favourite" && memory.itemId) {
    const had = list.some(
      (m) => m.kind === "favourite" && m.itemId === memory.itemId,
    );
    if (had)
      return list.filter(
        (m) => !(m.kind === "favourite" && m.itemId === memory.itemId),
      );
  }
  return [...list, memory];
}

export const withoutMemory = (
  list: readonly Memory[],
  id: string,
): readonly Memory[] => list.filter((m) => m.id !== id);

// ---------------------------------------------------------------------------
// The day, running late

/**
 * Clock times pushed back by how far behind the person says they are. The
 * plan itself is untouched — this is arithmetic on the phone, said as such.
 */
export function shifted(
  minutesAfterMidnight: number | undefined,
  behind: number,
): number | undefined {
  return minutesAfterMidnight === undefined
    ? undefined
    : minutesAfterMidnight + behind;
}

// ---------------------------------------------------------------------------
// The recap

export interface RecapStop {
  readonly id: string;
  readonly name: string;
  readonly done: boolean;
  readonly skipped: boolean;
  readonly favourite: boolean;
  readonly notes: readonly Memory[];
  readonly photos: readonly Memory[];
}

export interface Recap {
  readonly stops: readonly RecapStop[];
  readonly doneCount: number;
  readonly skippedCount: number;
  readonly favourites: readonly RecapStop[];
  readonly photoCount: number;
  /** Notes and photos not tied to any one stop. */
  readonly loose: readonly Memory[];
  readonly started: boolean;
}

export function recapOf(
  stops: readonly { readonly id: string; readonly name: string }[],
  done: readonly string[],
  skipped: readonly string[],
  memories: readonly Memory[],
  started: boolean,
): Recap {
  const known = new Set(stops.map((s) => s.id));
  const per = stops.map((s): RecapStop => {
    const mine = memories.filter((m) => m.itemId === s.id);
    return {
      id: s.id,
      name: s.name,
      done: done.includes(s.id),
      skipped: skipped.includes(s.id) && !done.includes(s.id),
      favourite: mine.some((m) => m.kind === "favourite"),
      notes: mine.filter((m) => m.kind === "note"),
      photos: mine.filter((m) => m.kind === "photo"),
    };
  });
  return {
    stops: per,
    doneCount: per.filter((s) => s.done).length,
    skippedCount: per.filter((s) => s.skipped).length,
    favourites: per.filter((s) => s.favourite),
    photoCount: memories.filter((m) => m.kind === "photo").length,
    loose: memories.filter(
      (m) => m.kind !== "favourite" && (!m.itemId || !known.has(m.itemId)),
    ),
    started,
  };
}

/** The headline of a recap, said the way a person would say it. */
export function recapLine(recap: Recap, total: number): string {
  if (total === 0) return "A day to remember.";
  if (recap.doneCount === 0 && recap.photoCount === 0)
    return `${total} ${total === 1 ? "stop" : "stops"} planned. Tell us how it really went.`;
  const parts = [`${recap.doneCount} of ${total} done`];
  if (recap.skippedCount > 0) parts.push(`${recap.skippedCount} skipped`);
  if (recap.photoCount > 0)
    parts.push(
      `${recap.photoCount} ${recap.photoCount === 1 ? "photo" : "photos"}`,
    );
  if (recap.favourites.length > 0)
    parts.push(
      `${recap.favourites.length} ${recap.favourites.length === 1 ? "favourite" : "favourites"}`,
    );
  return parts.join(" · ");
}

// ---------------------------------------------------------------------------
// Sharing: text that is safe to send anywhere

/**
 * What to send a friend about the adventure. Titles and place names only —
 * no private link, no member names, no notes — so sharing it discloses
 * nothing the person did not type into the message themselves.
 */
export function shareText(
  title: string,
  when: string | null,
  stops: readonly string[],
): string {
  const lines = [
    `${title}${when ? ` — ${when}` : ""}`,
    ...stops.slice(0, 8).map((s, i) => `${i + 1}. ${s}`),
    ...(stops.length > 8 ? [`…and ${stops.length - 8} more`] : []),
    "Planned with Go Have a Day",
  ];
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Before you go

export interface Prep {
  readonly kind: "booking" | "weather" | "cost" | "hours";
  readonly stop: string;
  readonly text: string;
}

const BOOKING = /reserv|book|ticket|appointment|advance|sold out|waitlist/i;

/**
 * **What to sort out before the day**, taken only from what the builder
 * recorded for each stop — published prices and hours, the rain notes, and any
 * note that mentions booking. Nothing is suggested that the data did not
 * say (no "bring a jacket" for a day nobody checked the weather for).
 */
export function preparations(
  stops: readonly {
    readonly name: string;
    readonly detail: StopDetail | undefined;
  }[],
): readonly Prep[] {
  const out: Prep[] = [];
  for (const { name, detail } of stops) {
    if (!detail) continue;
    for (const n of detail.notes)
      if (BOOKING.test(n)) out.push({ kind: "booking", stop: name, text: n });
    if (detail.cost)
      out.push({
        kind: "cost",
        stop: name,
        text: `Published price: ${detail.cost}`,
      });
    if (detail.hours)
      out.push({
        kind: "hours",
        stop: name,
        text: `Published hours: ${detail.hours}`,
      });
    if (detail.rain === "exposed")
      out.push({
        kind: "weather",
        stop: name,
        text: detail.rainPlan
          ? `Open to the weather — ${detail.rainPlan.title} is the rainy-day swap.`
          : "Open to the weather — dress for the day.",
      });
    if (detail.rain === "may-not-run")
      out.push({
        kind: "weather",
        stop: name,
        text: "May not run in bad weather — check with them on the day.",
      });
  }
  return out;
}

/** An all-day calendar entry for the day: the one thing worth downloading. */
export function calendarFile(title: string, day: string, uid: string): string {
  const ymd = day.replaceAll("-", "");
  const next = new Date(Date.parse(`${day}T00:00:00Z`) + DAY_MS)
    .toISOString()
    .slice(0, 10)
    .replaceAll("-", "");
  const clean = title.replace(/[\r\n,;\\]/g, " ").trim();
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Go Have a Day//Passport//EN",
    "BEGIN:VEVENT",
    `UID:${uid}@gohaveaday`,
    `DTSTAMP:${ymd}T000000Z`,
    `DTSTART;VALUE=DATE:${ymd}`,
    `DTEND;VALUE=DATE:${next}`,
    `SUMMARY:${clean}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
