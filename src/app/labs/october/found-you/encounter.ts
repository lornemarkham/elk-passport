/**
 * **October Found You** — the encounter, as timing and as rules.
 *
 * The component draws this; it decides nothing. Everything that could be
 * *wrong* — which choice she recalls, whether she is allowed to claim a last
 * time, what she says to someone who cannot hear her — lives here as plain
 * functions, so it can be tested without driving a minute of deliberate
 * silence through a renderer.
 *
 * ## The turn this is built around
 *
 * It has to travel from *this page remembers my input* to *October remembers
 * me*, and the whole distance is covered by how she says it rather than by
 * what she knows.
 *
 * The first recall is flatly, checkably accurate — **"You chose LEAVE."** That
 * reads as software, and it is meant to.
 *
 * The second is **"That's what you chose last time."** Nothing new has been
 * learned. On a first visit it is an unanswerable little wrongness; on a
 * second it happens to be true. She is not permitted to *elaborate* on a last
 * time she has no record of — an invented detail would be a lie the visitor
 * could catch, and being caught is the only way this fails.
 *
 * All times in milliseconds. **These waits are the content, not loading.**
 */

import type { Door, Hearing, NumberChoice } from "@/lib/october/foundYou";

export type { Door, Hearing, NumberChoice };

/** What she has been told this time. */
export interface Choices {
  readonly number?: NumberChoice;
  readonly door?: Door;
  readonly hearing?: Hearing;
}

/** A beat. Most pacing is a multiple of this. */
export const BEAT = 1200;

export const OPENING = [
  { text: "You found a way out.", hold: 3000 },
  { text: "October notices things like that.", hold: 3800 },
] as const;

export const ASK_NUMBER = "Pick one.";
export const NUMBERS: readonly NumberChoice[] = ["10", "12", "31"];

/**
 * She has something to say about each, and none of it explains anything. The
 * numbers already mean something to her; the visitor has no idea yet.
 */
export function onNumber(n: NumberChoice): readonly string[] {
  if (n === "10") return ["That one is me.", "You weren't to know."];
  if (n === "12") return ["That one brings me back.", "It isn't up to me."];
  return ["That one is the end.", "Bold."];
}

export const ASK_DOOR = "Stay, or leave?";

/** Said immediately, and simply true. This is the software-sounding one. */
export function plainRecall(c: Choices): string {
  return c.door ? `You chose ${c.door}.` : "You chose.";
}

/**
 * Much later, and the same fact wearing a different coat.
 *
 * `before` is whether she has actually met this person. It changes nothing she
 * says — deliberately. If it changed the line, the ambiguity would collapse
 * into a feature, and the first-time visitor would be the only one who got the
 * interesting version.
 */
export function ambiguousRecall(): string {
  return "That's what you chose last time.";
}

export const ASK_HEARING = "Can you hear me?";

/** The one branch, and the only place NO is the better answer. */
export function onHearing(
  h: Hearing,
): readonly { text: string; hold: number }[] {
  if (h === "YES") {
    return [
      { text: "Oh.", hold: 2600 },
      { text: "You can.", hold: 3800 },
    ];
  }
  return [
    { text: "That's okay.", hold: 3200 },
    { text: "They couldn't either.", hold: 4200 },
  ];
}

/**
 * Earned, not dumped. Three short sentences with enough air between them that
 * the middle one is uncomfortable — which is why they are spaced here rather
 * than rendered as a list.
 */
export const OVERLOOKED = [
  { text: "They didn't see me.", hold: 3400 },
  { text: "They didn't hear me.", hold: 3800 },
  { text: "They walked right by me.", hold: 5000 },
] as const;

export const EXIT_LABEL = "EXIT";

/** After the button. The pause before the first line is the whole ending. */
export const AFTER_EXIT_BLACK = 6000;

export const ENDING = [
  { text: "You found the way out.", hold: 3600 },
  { text: "I couldn't.", hold: 4400 },
  { text: "So I followed you.", hold: 7000 },
] as const;

/** Shown on arrival to somebody she has met. Restrained on purpose. */
export const RECOGNITION = "I remember you.";

/**
 * Whether she may greet this visitor by recognising them.
 *
 * Only ever true from a real stored encounter. A fresh browser, a cleared one,
 * or storage she cannot read all resolve to false, because the one unforgivable
 * failure here is claiming to remember a stranger.
 */
export function greets(found: boolean): boolean {
  return found === true;
}
