import { localDay } from "@/domain/experience/eventTime";
import type { Passage } from "./passage";

/**
 * **The Room is not open yet.**
 *
 * The bible (§9.7) wants the Secret Room foreshadowed over days: "Not yet.",
 * then a locked door that briefly appears, then "Six nights.", and finally the
 * door opens. The anticipation may be scarier than the room. Until now the room
 * opened on any day and the foreshadowing was not built (§32).
 *
 * ## The schedule
 *
 * ```
 * Oct 13 – 19   not-yet   The door is dark. It says so.
 * Oct 20 – 24   light     A line of light under the door, once in a while.
 * Oct 25 – 30   counting  "Six nights." … "One night."
 * Oct 31 →      open      Halloween, and every day after it.
 * ```
 *
 * It is calendar-day arithmetic on the visitor's own local date, so no
 * daylight-saving boundary can move a night.
 *
 * ## Who is never shut out
 *
 * Anyone who has already been inside (`entered`), or carries anything the room
 * and the store gave them (`escaped`, `tape`, `played`). A door that was open
 * for you does not close because of a date. This is also what keeps a person
 * who started the puzzle yesterday from being locked out of its middle.
 *
 * ## What is not decided here
 *
 * The opening night is a product call, kept in one constant so it is one edit.
 * It lives in this browser's clock — someone can change their device date, and
 * the rule does not pretend otherwise; this is a door in a story, not a lock.
 */

export const ROOM_OPENS = "2026-10-31";

export type Threshold =
  | { readonly kind: "open" }
  | { readonly kind: "not-yet" }
  | { readonly kind: "light"; readonly nights: number }
  | { readonly kind: "counting"; readonly nights: number };

const DAY = 86_400_000;

/** Whole calendar days from one `YYYY-MM-DD` to another. */
function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY,
  );
}

/** Has this person been somewhere the date cannot take away? */
export function hasBeenInside(passage: Passage): boolean {
  return !!(
    passage.entered ||
    passage.escaped ||
    passage.tape ||
    passage.played
  );
}

/** `today` is a local `YYYY-MM-DD`; an unreadable day is an open door. */
export function thresholdOn(today: string, passage: Passage): Threshold {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today) || hasBeenInside(passage)) {
    return { kind: "open" };
  }
  const nights = daysBetween(today, ROOM_OPENS);
  if (nights <= 0) return { kind: "open" };
  if (nights >= 12) return { kind: "not-yet" };
  if (nights >= 7) return { kind: "light", nights };
  return { kind: "counting", nights };
}

export function thresholdAt(now: Date, passage: Passage): Threshold {
  return thresholdOn(localDay(now), passage);
}

const NUMBER = ["", "One", "Two", "Three", "Four", "Five", "Six"] as const;

/** What the door says. Only ever true: the count is the real nights left. */
export function doorLine(t: Threshold): string | null {
  switch (t.kind) {
    case "open":
      return null;
    case "not-yet":
    case "light":
      return "Not yet.";
    case "counting":
      return t.nights === 1 ? "One night." : `${NUMBER[t.nights]} nights.`;
  }
}

/** What comes back through the door when somebody knocks. Never the same twice in a row. */
export function answerToKnock(t: Threshold, knocks: number): string {
  const pick = (lines: readonly string[]) =>
    lines[(knocks - 1) % lines.length]!;
  switch (t.kind) {
    case "open":
      return "";
    case "not-yet":
      return pick([
        "Not yet.",
        "I heard you.",
        "Not yet. I mean it kindly.",
        "You're early.",
        "Go and do something else. Come back.",
      ]);
    case "light":
      return pick([
        "Soon. Stop looking at the light.",
        "Yes, I know it's on.",
        "Nearly. Don't wait up.",
        "I'm not ready.",
      ]);
    case "counting":
      return t.nights === 1
        ? pick([
            "Tomorrow.",
            "Tomorrow night. Wear something dark.",
            "One night.",
          ])
        : pick([
            "Not tonight.",
            "Count them. I am.",
            "I'll leave the light on.",
          ]);
  }
}
