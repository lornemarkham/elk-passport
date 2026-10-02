import type { DiscoveryIntent } from "@/lib/labs/discovery/intent";
import { eveningLine, isOpen, isWet, type Weather } from "./fit";

/**
 * **October, as a personality sitting on top of a generic engine.**
 *
 * Everything in `lib/labs/discovery` is deliberately ignorant of the month:
 * it knows about possibilities, intents, days and ranking. Everything that
 * makes the product feel like *October* — the words, the phrasing of a wish,
 * the names of the sections, the sentence about the sky — is here.
 *
 * That split is the point of the synthesis. A second Passport personality
 * would write its own version of this file, hand its own corpus to the pool,
 * and reuse the engine unchanged.
 */

/**
 * The phrases, and what each one *means* to the engine.
 *
 * This is where Experiment B stops being a separate system: "get out of the
 * house" is not a second way of filtering, it is a nicer way of saying
 * `{ feel: ["go-out"] }`, which is exactly what the *Go out* chip says. One
 * vocabulary, two registers.
 */
export interface Phrase {
  readonly id: string;
  /** Completes "I want to —". Lowercase; the surface sets the size. */
  readonly says: string;
  /** What October answers. Authored, never generated. */
  readonly answers: string;
  /** The same wish, in the engine's own terms. */
  readonly means: DiscoveryIntent;
}

export const PHRASES: readonly Phrase[] = [
  {
    id: "go-out",
    says: "get out of the house",
    answers: "Then here is what is actually on.",
    means: { feel: ["go-out"] },
  },
  {
    id: "stay-in",
    says: "stay in",
    answers: "Good. Nobody has to put shoes on.",
    means: { feel: ["stay-in"] },
  },
  {
    id: "scary",
    says: "be frightened",
    answers: "October has been waiting for you to ask.",
    means: { looking: ["scary"] },
  },
  {
    id: "family",
    says: "do something with a kid",
    answers: "Nothing here needs them to sit still.",
    means: { looking: ["family"] },
  },
  {
    id: "make",
    says: "make something",
    answers: "Clear the table.",
    means: { doing: ["make"] },
  },
  {
    id: "an-hour",
    says: "be done in an hour",
    answers: "Short things. Start one now.",
    means: { within: 75 },
  },
  {
    id: "surprise",
    says: "be surprised",
    answers: "Fine. Things you would never have gone looking for.",
    means: { surprise: true },
  },
];

export const phraseById = (id: string): Phrase | undefined =>
  PHRASES.find((p) => p.id === id);

/**
 * **Trust Me, as two questions and nothing more.**
 *
 * Each answer is an intent patch, so the playful route produces exactly what
 * a chip produces and lands the person back on the same surface with a wish
 * they can keep editing — rather than in a separate product with its own
 * results.
 */
export interface Fork {
  readonly id: string;
  readonly asks: string;
  readonly options: readonly {
    readonly label: string;
    readonly under: string;
    readonly means: DiscoveryIntent;
  }[];
}

export const FORKS: readonly Fork[] = [
  {
    id: "where",
    asks: "Inside, or outside?",
    options: [
      {
        label: "Inside",
        under: "A roof, a sofa, a kitchen table.",
        means: { feel: ["stay-in"] },
      },
      {
        // **Deliberately `feel` and not `where`.** Answering "outside" used
        // to set the Outdoors and Needs-a-clear-sky filters, and because
        // Atlas has classified only 41% of this corpus that removed nearly
        // every dated event — a playful question turned into a brick wall,
        // and the cards dealt were a farmers' market and a two-month meteor
        // shower. `go-out` is derived from a field every possibility has.
        label: "Outside",
        under: "Coat on. Whatever the sky is doing.",
        means: { feel: ["go-out"] },
      },
    ],
  },
  {
    id: "long",
    asks: "An hour, or the whole evening?",
    options: [
      {
        label: "An hour",
        under: "Something that starts and finishes.",
        means: { within: 75 },
      },
      {
        label: "The whole evening",
        under: "Make a thing of it.",
        means: { when: ["tonight"] },
      },
    ],
  },
];

/** The names October gives the temporal sections. */
export const SECTIONS = {
  alsoTonight: { title: "Also tonight" },
  closing: { title: "While it lasts", line: "Running out this week." },
  ahead: { title: "Coming up" },
  whenever: {
    title: "Whenever you like",
    line: "No date on any of these. They will still be here on Tuesday.",
  },
} as const;

/**
 * **The opening line, and the claim under it.**
 *
 * Experiment A's best moment was a page that said *"It is going to rain
 * tonight"* and then behaved as though it meant it. The sentence is only
 * allowed when the provider actually said something — on a machine with no
 * weather key this returns the plain opening, because a page that invents a
 * sky is worse than one that does not mention it.
 */
export function opening(w: Weather): {
  readonly headline: string;
  readonly under?: string;
} {
  const line = eveningLine(w);
  if (!line) return { headline: "Here is October." };
  if (isWet(w)) {
    return {
      headline: line,
      under: "So the inside things are first. Everything else is further down.",
    };
  }
  if (isOpen(w)) {
    return {
      headline: line,
      under: "A good night to be outside, and to look up.",
    };
  }
  return { headline: line };
}

/** What October says when a wish produced nothing. Never a dead end. */
export const NOTHING =
  "Nothing in October matches all of that. Take something off, or ask for something else.";
