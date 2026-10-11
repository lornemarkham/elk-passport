/**
 * **Go Offline — the modes, and what each one actually asks for.**
 *
 * The product promise, from the doctrine (§6): *Passport succeeds when people
 * engage more deeply with their lives — not when they spend more time in
 * Passport.* `ANALOG_PHILOSOPHY` in the Idea Atlas puts it as instructions:
 * *print it, fold it, put it in the truck; go somewhere with no cell service;
 * stumble onto something yourself.*
 *
 * This is not a digital-wellness product and there are no screen-time charts
 * in it. Each mode is a **sentence somebody could have typed**, which is why
 * it is a seed for the same parser rather than a second configuration system:
 * tapping *Family Unplugged* and typing "four hours with a five-year-old,
 * outdoors" reach the builder by the identical path.
 */
export interface OfflineMode {
  readonly id: string;
  readonly title: string;
  /** What it is for, in a sentence a person would nod at. */
  readonly blurb: string;
  /** The sentence it seeds the day with. Read by `readBrief` like any other. */
  readonly says: string;
}

export const OFFLINE_MODES: readonly OfflineMode[] = [
  {
    id: "two-hour",
    title: "Two-Hour Escape",
    blurb: "Out the door and back before anyone notices you left.",
    says: "two hours, close by, outdoors",
  },
  {
    id: "whole-day",
    title: "Whole Day",
    blurb: "Leave in the morning. Come back with a story.",
    says: "a whole day, outdoors, adventurous",
  },
  {
    id: "family",
    title: "Family Unplugged",
    blurb: "Everyone's phone in one bag. Somebody holds the bag.",
    says: "four hours with the kids, outdoors, somewhere with a playground and a picnic",
  },
  {
    id: "get-lost",
    title: "Get Lost",
    blurb: "Further than you'd normally go, on purpose.",
    says: "a whole day, adventurous, go further, hiking",
  },
  {
    id: "meet-humans",
    title: "Meet Humans",
    blurb: "Somewhere with other people in it, talking.",
    says: "four hours, a market or a cafe, coffee and food, close by",
  },
  {
    id: "surprise",
    title: "Surprise Me",
    blurb: "Something unusual. No preview.",
    says: "four hours, something unusual and weird, nearby",
  },
];

export const modeById = (id: string | undefined): OfflineMode | undefined =>
  id ? OFFLINE_MODES.find((m) => m.id === id) : undefined;
