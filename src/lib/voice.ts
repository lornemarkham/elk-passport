/**
 * **How Go Have a Day sounds.**
 *
 * The owner's brief (2026-11-08): Canadian, friendly, adventurous, slightly
 * cheeky, funny without trying too hard, never corporate — understated, and
 * never at the cost of saying clearly what happened. Doctrine §16 keeps the
 * register; these are the production strings that carry it.
 *
 * One place, so the voice is one voice: a line that appears on two screens
 * reads the same on both. Every line still says the plain fact first — what
 * was saved, how many, what the button does — and the personality rides on
 * top of it, never instead of it.
 */

/** After a save. The fact (it's in the Pocket) is the whole sentence. */
export const SAVED_LINES = [
  "Good find. Into the Pocket.",
  "Into the Pocket it goes.",
  "Nice. That's in the Pocket.",
] as const;

/** A line for the nth save this visit — varied, never random, so tests can read it. */
export const savedLine = (nth: number) =>
  SAVED_LINES[Math.abs(nth) % SAVED_LINES.length]!;

/** "3 ideas saved" — the Pocket's count, said plainly. */
export const ideasCount = (n: number) =>
  `${n} ${n === 1 ? "idea" : "ideas"} saved`;

/** The Pocket's own line, by how full it is. */
export function pocketLine(n: number): string {
  if (n === 0) return "Nothing in here yet. Go find something good.";
  if (n === 1) return "One good idea. A couple more and that's a day.";
  if (n <= 4) return "That's the makings of a pretty good day.";
  return "There's a whole weekend in here.";
}

/** A day the Day Builder has just put together. */
export const GOOD_DAY = "Well, that looks like a pretty good day.";

/** Removed from the Pocket, with Undo beside it. */
export const REMOVED = "Out of the Pocket.";

/** Put back after an Undo. */
export const RESTORED = "Back in the Pocket.";

/** My Stuff's opening line. */
export const MY_STUFF_LINE =
  "Everything you've saved, the days you're planning, and the ones you've had.";

/** Memories, when there are none yet. */
export const NO_MEMORIES =
  "Nothing here yet. That's not a criticism — just an invitation.";

/** After a day is finished. */
export const DO_IT_AGAIN = "Same again? Or something completely different?";
