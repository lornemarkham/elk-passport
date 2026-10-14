/**
 * **Everything October remembers, in one place.**
 *
 * She keeps three small records, all in this browser's `localStorage` and
 * nowhere else:
 *
 * | key                                  | written by                 | holds                                              |
 * | ------------------------------------ | -------------------------- | -------------------------------------------------- |
 * | `elk-passport:october:found-you`     | Found You                  | that you finished it, and three taps               |
 * | `elk-passport:october:witching-hour` | Witching Hour              | which ending you reached, the last time            |
 * | `october:passage:v1`                 | Video Store, Secret Room   | the tape, the refusal, the door, the tape played   |
 *
 * The first is `foundYou.ts`'s, unchanged, so nobody she already knows is
 * forgotten by this file existing. The second follows the same guarded,
 * fail-soft pattern: an SSR guard, a try/catch on every touch, and anything
 * unparseable read as *never happened*. The third is the passage between the
 * store and the room (`domain/october/passage.ts`); it is owned there and only
 * read and forgotten here.
 *
 * ## What this is not
 *
 * Not analytics, and not an account. Nothing is sent anywhere, and nothing
 * here follows a person to another device — which is
 * why every sentence that describes it says *this browser*. Signing in does
 * not change it either: the account keeps what you chose to keep, and this
 * keeps what you did in front of her.
 *
 * The first two records hold no time at all. The passage notes *when* each
 * thing first happened, so a later beat can say how long ago; nothing reads
 * the times yet, and the sentences below do not mention them.
 *
 * ## Inspectable and resettable
 *
 * `describe` turns the records into plain sentences, one per recorded fact,
 * and only from recorded facts — there is no sentence for anything she was
 * not told. `forgetEverything` removes all three keys. Both are shown to the
 * person on My October; the keys are also there, readable, in the browser's
 * own storage inspector.
 */

import {
  NOTHING,
  forgetOctober,
  readOctoberMemory,
  type OctoberMemory,
} from "./foundYou";
import {
  forgetPassage,
  getPassage,
  type Passage,
} from "@/domain/october/passage";

const NIGHT_KEY = "elk-passport:october:witching-hour";

/** How a Witching Hour ended. `escape` is "I've had enough". */
export type Ending = "inside" | "outside" | "story" | "surprise" | "escape";

const ENDINGS: readonly string[] = [
  "inside",
  "outside",
  "story",
  "surprise",
  "escape",
];

export interface NightMemory {
  /** The last ending reached. Absent if no night has been finished here. */
  readonly ended?: Ending;
}

const NO_NIGHT: NightMemory = {};

function parseNight(raw: string | null): NightMemory {
  if (!raw) return NO_NIGHT;
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    if (!v || typeof v !== "object") return NO_NIGHT;
    return typeof v.ended === "string" && ENDINGS.includes(v.ended)
      ? { ended: v.ended as Ending }
      : NO_NIGHT;
  } catch {
    return NO_NIGHT;
  }
}

/** Exported for tests; the browser path goes through `readNightMemory`. */
export const parseNightMemory = parseNight;

export function readNightMemory(): NightMemory {
  if (typeof window === "undefined") return NO_NIGHT;
  try {
    return parseNight(window.localStorage.getItem(NIGHT_KEY));
  } catch {
    return NO_NIGHT;
  }
}

/** Kept once, when a night actually reaches an ending. */
export function rememberNight(ended: Ending): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NIGHT_KEY, JSON.stringify({ ended }));
  } catch {
    // Then she will not know about this night. That is the safe direction.
  }
}

export interface OctoberRemembers {
  readonly foundYou: OctoberMemory;
  readonly night: NightMemory;
  readonly passage: Passage;
}

export const REMEMBERS_NOTHING: OctoberRemembers = {
  foundYou: NOTHING,
  night: NO_NIGHT,
  passage: {},
};

export function whatOctoberRemembers(): OctoberRemembers {
  return {
    foundYou: readOctoberMemory(),
    night: readNightMemory(),
    passage: getPassage(),
  };
}

/**
 * The records as sentences a person can read and check. One per fact, and
 * only facts that were written down: a choice that was never recorded has no
 * sentence, rather than a guess.
 */
export function describe(r: OctoberRemembers): string[] {
  const out: string[] = [];
  const f = r.foundYou;
  if (f.found) {
    out.push("That you found her, and found the way out.");
    if (f.number) out.push(`That you picked ${f.number}.`);
    if (f.door) out.push(`That you chose ${f.door}.`);
    if (f.hearing === "YES") out.push("That you said you could hear her.");
    if (f.hearing === "NO") out.push("That you said you couldn't hear her.");
  }
  const ended = r.night.ended;
  if (ended === "inside") out.push("That you stayed inside, the last night.");
  if (ended === "outside") out.push("That you went outside, the last night.");
  if (ended === "story")
    out.push("That you asked her to tell you something, the last night.");
  if (ended === "surprise")
    out.push("That you asked her to surprise you, the last night.");
  if (ended === "escape")
    out.push("That you told her you'd had enough, the last night.");
  const p = r.passage;
  if (p.refused) out.push("That she took a tape back from you.");
  if (p.tape) out.push("That you took the tape nobody catalogued.");
  if (p.escaped) out.push("That you opened the door in the room.");
  if (p.played) out.push("That you played the tape where it was made.");
  return out;
}

/** Every record, gone. She will not recognise this browser afterwards. */
export function forgetEverything(): void {
  forgetOctober();
  forgetPassage();
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(NIGHT_KEY);
  } catch {
    // Nothing to be done.
  }
}
