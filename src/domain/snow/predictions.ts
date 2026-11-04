import type { Person, SnowDay } from "./day";

/**
 * **Predictions: call it before it happens, settle it after.**
 *
 * A prediction is a yes/no line about the crew's own day. Nobody can know the
 * answer in advance and nothing outside the crew decides it: someone in the
 * crew settles it once it has happened. So Snow never claims a fact about the
 * mountain, the weather or a lift. The starters below are about people, not
 * conditions, and crew-written ones go through the same safety check as
 * challenges.
 */
export interface Prediction {
  readonly id: string;
  readonly text: string;
  readonly by: string;
  /** personId → "yes it happens" (true) or "no it doesn't" (false). */
  readonly guesses: Readonly<Record<string, boolean>>;
  /** Set when the crew settles it. Absent while it is still open. */
  readonly outcome?: boolean;
}

export const PREDICTION_STARTERS: readonly string[] = [
  "Someone forgets their gloves or goggles.",
  "We're on the first chair before 9:30.",
  "Somebody wants a hot chocolate before noon.",
  "We all make it to lunch at the same time.",
  "Someone falls over on the very first run.",
  "We take a group photo at the top.",
  "Somebody says “one more run” and means three.",
  "Everyone is in the lodge by the time the lifts close.",
];

/** Points for calling a settled prediction correctly. */
export const PREDICTION_POINTS = 3;
/** Cap per person, so a long list doesn't swamp the day. */
export const PREDICTION_CAP = 5;

export const isSettled = (p: Prediction) => p.outcome !== undefined;

export function correctCalls(day: SnowDay, personId: string): number {
  return day.predictions.filter(
    (p) => isSettled(p) && p.guesses[personId] === p.outcome,
  ).length;
}

export function predictionPoints(day: SnowDay, personId: string): number {
  return (
    Math.min(correctCalls(day, personId), PREDICTION_CAP) * PREDICTION_POINTS
  );
}

/** People who called the most settled predictions correctly (needs ≥1). */
export function bestCallers(day: SnowDay): Person[] {
  const n = (p: Person) => correctCalls(day, p.id);
  const best = Math.max(0, ...day.people.map(n));
  return best > 0 ? day.people.filter((p) => n(p) === best) : [];
}

export function tally(p: Prediction) {
  const votes = Object.values(p.guesses);
  return {
    yes: votes.filter(Boolean).length,
    no: votes.filter((v) => !v).length,
  };
}
