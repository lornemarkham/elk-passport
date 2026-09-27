/**
 * **What October keeps.**
 *
 * One key, following the same guarded, fail-soft pattern as
 * `data/activeBoardStorage.ts`: an SSR guard, a try/catch on every touch, and
 * a safe answer when storage is unavailable or the contents make no sense.
 *
 * ## Nothing here identifies anybody
 *
 * Three choices and a flag, in this browser, for this person, readable only by
 * this origin. No fingerprint, no address, no device, no network — the drama
 * is entirely in how it is *said* later, not in what is known. That is the
 * whole trick, and it is worth keeping honest: if this ever needs more than a
 * visitor's own choices to work, the idea has gone wrong rather than got
 * better.
 *
 * ## Failing to remember is the safe failure
 *
 * Private browsing, a cleared profile, a quota error — every one of them ends
 * with October not recognising you, which is merely a quieter encounter. The
 * unsafe failure is the other direction: claiming to remember somebody who has
 * never been here. So anything unparseable is treated as never having happened.
 */

const KEY = "elk-passport:october:found-you";

export type NumberChoice = "10" | "12" | "31";
export type Door = "STAY" | "LEAVE";
export type Hearing = "YES" | "NO";

export interface OctoberMemory {
  /** `october_found_you`. The only thing other surfaces need. */
  readonly found: boolean;
  readonly number?: NumberChoice;
  readonly door?: Door;
  readonly hearing?: Hearing;
}

/** Nobody has been here. The answer whenever anything is wrong. */
export const NOTHING: OctoberMemory = { found: false };

const NUMBERS: readonly string[] = ["10", "12", "31"];

/** Narrow unknown storage contents to something we will act on. */
function parse(raw: string | null): OctoberMemory {
  if (!raw) return NOTHING;
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    if (!v || typeof v !== "object" || v.found !== true) return NOTHING;
    return {
      found: true,
      number:
        typeof v.number === "string" && NUMBERS.includes(v.number)
          ? (v.number as NumberChoice)
          : undefined,
      door:
        v.door === "STAY" || v.door === "LEAVE" ? (v.door as Door) : undefined,
      hearing:
        v.hearing === "YES" || v.hearing === "NO"
          ? (v.hearing as Hearing)
          : undefined,
    };
  } catch {
    // Someone else's data, or ours from a previous shape. Either way she has
    // not met this person.
    return NOTHING;
  }
}

/** Exported for tests; the browser path goes through `readOctoberMemory`. */
export const parseOctoberMemory = parse;

export function readOctoberMemory(): OctoberMemory {
  if (typeof window === "undefined") return NOTHING;
  try {
    return parse(window.localStorage.getItem(KEY));
  } catch {
    return NOTHING;
  }
}

export function rememberEncounter(m: Omit<OctoberMemory, "found">): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ found: true, ...m }));
  } catch {
    // She simply will not recognise them next time.
  }
}

export function forgetOctober(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to be done, and nothing that matters.
  }
}
