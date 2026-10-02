import type { Possibility } from "./possibility";
import { fitFor, type Context } from "./fit";

/**
 * **What a person feels like, as the thing they choose first.**
 *
 * A filter bar asks *which database table* in a friendly voice. These ask the
 * question people actually ask themselves at six o'clock, and the answer
 * reorders everything rather than hiding most of it — `weigh` returns a bonus,
 * not a boolean, so choosing "scare me" lifts the haunt and the nightmare
 * films to the top without deleting the pumpkin patch. Nothing disappears
 * because of a mood.
 *
 * `surprise` is the exception that proves the shape: it is a real intention,
 * it has to behave differently from the others, and it does so by inverting
 * the usual preference — it rewards the possibilities a contextual feed would
 * bury.
 */

export interface Intent {
  readonly id: string;
  /** Completes "Tonight I want to —". Lowercase; the surface sets the size. */
  readonly phrase: string;
  /** What October says back once this is chosen. Authored, not generated. */
  readonly answer: string;
  /** Added to the fit score. Positive lifts, negative sinks, nothing is cut. */
  weigh(p: Possibility, ctx: Context): number;
}

const minutes = (p: Possibility) => p.minutes ?? 0;

export const INTENTS: readonly Intent[] = [
  {
    id: "get-out",
    phrase: "get out of the house",
    answer: "Then here is what is actually on.",
    weigh: (p) =>
      (p.tags.includes("go-out") ? 6 : -4) +
      (p.availability.shape === "fixed" ? 2 : 0),
  },
  {
    id: "stay-in",
    phrase: "stay in",
    answer: "Good. Nobody has to put shoes on.",
    weigh: (p) => (p.tags.includes("stay-in") ? 6 : -5),
  },
  {
    id: "scare-me",
    phrase: "be frightened",
    answer: "October has been waiting for you to ask.",
    weigh: (p) =>
      (p.scare !== undefined ? p.scare * 3 : 0) +
      (p.setting === "outdoor-night" ? 4 : 0) +
      (/haunt|fright|scream|horror|terror|ghost/.test(p.text) ? 4 : 0) -
      (p.withKids ? 2 : 0),
  },
  {
    id: "with-a-kid",
    phrase: "do something with a kid",
    answer: "Nothing here needs them to sit still.",
    weigh: (p) =>
      (p.withKids ? 7 : 0) -
      (p.scare !== undefined && p.scare >= 2 ? 6 : 0) -
      (p.setting === "outdoor-night" ? 2 : 0),
  },
  {
    id: "make",
    phrase: "make something",
    answer: "Clear the table.",
    weigh: (p) => (p.source === "doing" ? 8 : p.tags.includes("make") ? 4 : -3),
  },
  {
    id: "an-hour",
    phrase: "be done in an hour",
    answer: "Short things. Start one now.",
    weigh: (p) => {
      // A length nobody stated is not a long one. Most Doings carry no
      // minutes and genuinely can be half an hour, so they stay mildly
      // welcome — while anything that *has* said how long it is gets taken at
      // its word. The earlier version treated a 147-minute film as neutral,
      // which put it in the first five answers to "be done in an hour".
      if (p.availability.needsPlanning) return -6;
      const m = minutes(p);
      if (m === 0) return 2;
      if (m <= 75) return 6;
      if (m <= 110) return -2;
      return -6;
    },
  },
  {
    id: "a-whole-evening",
    phrase: "make a night of it",
    answer: "Then it should be worth the whole evening.",
    weigh: (p) =>
      (minutes(p) >= 100 ? 5 : 0) +
      (p.availability.shape === "fixed" ? 4 : 0) +
      (p.setting === "outdoor-night" ? 3 : 0) -
      (minutes(p) > 0 && minutes(p) < 60 ? 4 : 0),
  },
  {
    id: "surprise",
    phrase: "be surprised",
    answer: "Fine. Things you would never have gone looking for.",
    // Deliberately backwards. Everything else in this lab rewards the obvious
    // fit; this rewards the long tail, which is where "I had no idea this
    // existed" actually lives. It is seeded per evening rather than per
    // render, so the page does not reshuffle under a click.
    weigh: (p, ctx) => 10 - fitFor(p, ctx).score * 2 + stableJitter(p.id, 4),
  },
];

export const intentById = (id: string): Intent | undefined =>
  INTENTS.find((i) => i.id === id);

/**
 * A small, repeatable wobble from an id — same id, same number, every render.
 *
 * `Math.random` in a feed means the server and the browser disagree about the
 * order, which React reports as a hydration error and a person experiences as
 * the page rearranging itself a moment after it loads.
 */
export function stableJitter(id: string, spread: number): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h) % spread;
}

/**
 * Rank for a chosen intention: the evening's fit, then what they asked for.
 *
 * Ties break on a hash of the id rather than the title, for the same reason
 * `byFit` does — an alphabetical run is what a database looks like.
 */
export function byIntent(intent: Intent, ctx: Context) {
  return (a: Possibility, b: Possibility): number => {
    const of = (p: Possibility) => fitFor(p, ctx).score + intent.weigh(p, ctx);
    return of(b) - of(a) || stableJitter(a.id, 997) - stableJitter(b.id, 997);
  };
}
