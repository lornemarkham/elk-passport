/**
 * **What a person carries from one of October's places to another.**
 *
 * The Video Store and the Secret Room are separate routes that share nothing
 * but the person walking between them. This is the whole of what travels, and
 * it is deliberately three booleans' worth: a small real seam, not a save
 * system. It lives in this browser only — there is no account behind it, and
 * the audit's note that Found You's memory is likewise local still stands.
 *
 * - `tape`    — the unlabeled tape from the bottom shelf of the store.
 * - `refused` — October has already taken a tape back from you, once. It does
 *               not do it twice; the refusal is a first meeting, not a toll.
 * - `escaped` — the room's door has opened for you.
 *
 * Every field is a time (ms since epoch) rather than a flag so that a later
 * beat can say *how long ago*, which is what October's memory is mostly for.
 */

export const PASSAGE_KEY = "october:passage:v1";

export interface Passage {
  readonly tape?: number;
  readonly refused?: number;
  readonly escaped?: number;
  /** The tape has been played in the room. The secret ending has been seen. */
  readonly played?: number;
}

export type PassageKey = keyof Passage;

const KEYS: readonly PassageKey[] = ["tape", "refused", "escaped", "played"];

/** Anything unreadable is nothing remembered. A corrupt note is not an error. */
export function parsePassage(raw: string | null | undefined): Passage {
  if (!raw) return {};
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return {};
    const out: Partial<Record<PassageKey, number>> = {};
    for (const key of KEYS) {
      const at = (value as Record<string, unknown>)[key];
      if (typeof at === "number" && Number.isFinite(at) && at > 0) {
        out[key] = at;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function remember(
  passage: Passage,
  key: PassageKey,
  now: number,
): Passage {
  // The first time is the time. Remembering twice does not move it.
  return passage[key] ? passage : { ...passage, [key]: now };
}

// ---------------------------------------------------------------- storage
//
// `useSyncExternalStore` wants a snapshot that is referentially stable until
// something changes, so the parsed value is cached against the raw string.

let cachedRaw: string | null | undefined;
let cached: Passage = {};
const listeners = new Set<() => void>();

function read(): Passage {
  if (typeof window === "undefined") return EMPTY;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(PASSAGE_KEY);
  } catch {
    // Storage blocked (private mode, a locked-down webview). Remembering
    // nothing is the correct failure.
    return EMPTY;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = parsePassage(raw);
  }
  return cached;
}

const EMPTY: Passage = Object.freeze({});

export function getPassage(): Passage {
  return read();
}

export function getServerPassage(): Passage {
  return EMPTY;
}

export function subscribePassage(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === PASSAGE_KEY || e.key === null) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** Write one memory. Safe to call repeatedly; the first time wins. */
export function rememberPassage(key: PassageKey, now = Date.now()): void {
  if (typeof window === "undefined") return;
  const prior = read();
  const next = remember(prior, key, now);
  if (next === prior) return;
  try {
    window.localStorage.setItem(PASSAGE_KEY, JSON.stringify(next));
  } catch {
    return;
  }
  for (const l of listeners) l();
}

/** All of it, gone — My October's "Make her forget". */
export function forgetPassage(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PASSAGE_KEY);
  } catch {
    return;
  }
  for (const l of listeners) l();
}
