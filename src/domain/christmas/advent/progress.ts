/**
 * **What a family has opened, swapped and done** — kept on this browser
 * (localStorage), so taking part needs no account. One small JSON record;
 * nothing about where anybody went leaves the device.
 *
 * A completed day keeps what was done as it was at the time (title and
 * emoji), so the calendar still says "Skated at Polson Park" after the
 * listing has gone from Atlas.
 */

export const PROGRESS_KEY = "ghad-advent-2026";

export interface DoneDay {
  readonly key: string;
  readonly title: string;
  readonly emoji: string;
}

export interface Progress {
  /** Day number → what was done. */
  readonly done: Readonly<Record<number, DoneDay>>;
  /** Day number → how many times it was swapped. */
  readonly swaps: Readonly<Record<number, number>>;
  /** Day numbers whose door has been opened. */
  readonly opened: readonly number[];
}

export const EMPTY_PROGRESS: Progress = { done: {}, swaps: {}, opened: [] };

const isDay = (n: number) => Number.isInteger(n) && n >= 1 && n <= 40;

/** Read what was stored; anything malformed is dropped, not trusted. */
export function readProgress(raw: string | null | undefined): Progress {
  if (!raw) return EMPTY_PROGRESS;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return EMPTY_PROGRESS;
  }
  if (!parsed || typeof parsed !== "object") return EMPTY_PROGRESS;
  const p = parsed as Record<string, unknown>;
  const done: Record<number, DoneDay> = {};
  for (const [k, v] of Object.entries(
    (p.done as Record<string, unknown>) ?? {},
  )) {
    const n = Number(k);
    const d = v as Partial<DoneDay> | null;
    if (
      isDay(n) &&
      d &&
      typeof d.key === "string" &&
      typeof d.title === "string" &&
      typeof d.emoji === "string"
    )
      done[n] = {
        key: d.key.slice(0, 80),
        title: d.title.slice(0, 160),
        emoji: d.emoji.slice(0, 8),
      };
  }
  const swaps: Record<number, number> = {};
  for (const [k, v] of Object.entries(
    (p.swaps as Record<string, unknown>) ?? {},
  )) {
    const n = Number(k);
    if (isDay(n) && typeof v === "number" && Number.isInteger(v) && v > 0)
      swaps[n] = Math.min(v, 999);
  }
  const opened = Array.isArray(p.opened)
    ? [...new Set(p.opened.filter((n): n is number => isDay(Number(n))))]
    : [];
  return { done, swaps, opened };
}

export const completedCount = (p: Progress) => Object.keys(p.done).length;

export const open = (p: Progress, day: number): Progress =>
  p.opened.includes(day) ? p : { ...p, opened: [...p.opened, day] };

/** Swap a day's adventure for the next one (a done day stays done). */
export const swap = (p: Progress, day: number): Progress =>
  p.done[day]
    ? p
    : { ...p, swaps: { ...p.swaps, [day]: (p.swaps[day] ?? 0) + 1 } };

/** Mark a day done with what was done, or undo it. */
export function toggleDone(
  p: Progress,
  day: number,
  what: DoneDay | undefined,
): Progress {
  const done = { ...p.done };
  if (done[day] || !what) delete done[day];
  else done[day] = what;
  return { ...p, done };
}

/** "You've completed 7 adventures!" */
export function progressLine(count: number): string {
  if (count === 0) return "Open a door to start your first adventure.";
  if (count === 1) return "You've completed 1 adventure!";
  if (count >= 25)
    return `You've completed ${count} adventures — a whole Advent!`;
  return `You've completed ${count} adventures!`;
}
