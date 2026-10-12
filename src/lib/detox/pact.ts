/**
 * **The pact — the one bit of Go Offline that is a game.**
 *
 * Doctrine §6 asks for challenges, bets and friendly competition that make a
 * day more fun while people are already together, and never pull them out of
 * it. So the pact is three small things decided before anyone leaves the
 * house: where the phones go, what the first person to crack owes, and three
 * things to pull off out there.
 *
 * ## Why none of these name a place
 *
 * The day's per-stop challenges come from `challengeFor` in
 * `src/domain/day/build.ts`, which only writes one where Atlas states the
 * feature it relies on — *no stated feature, no challenge*. The cards here
 * are the other kind: things that are true of **any** day out, so they can
 * be dealt before anyone knows where the day is going and still never claim
 * something about a place that nobody checked.
 *
 * ## What is deliberately absent
 *
 * No streaks, no scores, no screen-time numbers. Analog Adventures already
 * said why: every metric we'd reach for rewards the opposite behaviour.
 */

export interface PhonePlace {
  readonly id: string;
  readonly label: string;
  readonly line: string;
}

export const PHONE_PLACES: readonly PhonePlace[] = [
  {
    id: "glovebox",
    label: "The glovebox",
    line: "Close enough for an emergency. Far enough to forget.",
  },
  {
    id: "one-bag",
    label: "One bag, one keeper",
    line: "Everybody's phone in one bag. Somebody holds the bag.",
  },
  {
    id: "home",
    label: "Left at home",
    line: "The bold one. Paper, a full tank and somebody's watch.",
  },
];

export interface Stake {
  readonly id: string;
  /** Finishes "Whoever reaches for a phone first…" */
  readonly owes: string;
}

export const STAKES: readonly Stake[] = [
  { id: "ice-cream", owes: "buys the ice cream" },
  { id: "aux", owes: "loses the music on the drive home" },
  { id: "bags", owes: "carries everything back to the car" },
  { id: "dishes", owes: "does tonight's dishes" },
  { id: "song", owes: "sings one full song, chosen by the group" },
];

export interface Challenge {
  readonly id: string;
  readonly line: string;
}

/**
 * The deck. Every card is something a person can do on any outing, with a
 * phone in a bag, and every one of them is better with somebody else there.
 */
export const CHALLENGES: readonly Challenge[] = [
  {
    id: "ask-a-local",
    line: "Ask somebody who lives here what they'd do today. Then do it.",
  },
  {
    id: "signs-only",
    line: "Get to one stop on road signs and memory alone.",
  },
  {
    id: "draw-it",
    line: "No photo of the best view. Draw it instead. Badly counts.",
  },
  {
    id: "older-than-us",
    line: "Find something older than everyone in your group put together.",
  },
  {
    id: "wrong-turn",
    line: "Take one turn you'd normally skip, on purpose.",
  },
  {
    id: "first-name",
    line: "Learn the first name of somebody who works somewhere you stop.",
  },
  {
    id: "never-ordered",
    line: "Eat one thing nobody in the group has ever ordered.",
  },
  {
    id: "count-five",
    line: "Spot five different birds, trees or dogs. Group's choice.",
  },
  {
    id: "no-googling",
    line: "Settle one argument without looking it up. Loudest guess wins.",
  },
  {
    id: "best-bench",
    line: "Find the best bench of the day and sit on it for five minutes.",
  },
  {
    id: "free-souvenir",
    line: "Bring home one thing that cost nothing.",
  },
  {
    id: "say-hello",
    line: "Say good morning to the next five people you pass.",
  },
];

const byId = <T extends { readonly id: string }>(list: readonly T[]) => {
  const map = new Map(list.map((item) => [item.id, item]));
  return (id: string | undefined): T | undefined =>
    id ? map.get(id) : undefined;
};

export const phonePlaceById = byId(PHONE_PLACES);
export const stakeById = byId(STAKES);
export const challengeById = byId(CHALLENGES);

/** How many cards a pact deals. Three fits on a hand, and on a fridge. */
export const HAND = 3;

/**
 * **A small seeded shuffle**, so a deal is reproducible.
 *
 * The page renders on the server first; a `Math.random()` deal would hand the
 * browser a different hand from the markup. A seed makes the first deal the
 * same everywhere, and "deal again" is just the next seed.
 */
function rng(seed: number): () => number {
  let s = seed >>> 0 || 0x9e3779b9;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deal `HAND` distinct challenges from the deck. */
export function deal(seed: number, hand: number = HAND): readonly Challenge[] {
  const next = rng(seed);
  const deck = [...CHALLENGES];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [deck[i], deck[j]] = [deck[j]!, deck[i]!];
  }
  return deck.slice(0, Math.min(hand, deck.length));
}

export interface Pact {
  readonly phone: string;
  readonly stake: string;
  readonly challenges: readonly string[];
  /** The seed the hand came from, so "deal again" moves forward. */
  readonly seed: number;
}

/** The pact a person sees before they've touched anything. */
export function defaultPact(seed = 1): Pact {
  return {
    phone: PHONE_PLACES[1]!.id,
    stake: STAKES[0]!.id,
    challenges: deal(seed).map((c) => c.id),
    seed,
  };
}

/** A fresh hand, keeping the rest of the pact as it was. */
export function redeal(pact: Pact): Pact {
  const seed = pact.seed + 1;
  return { ...pact, seed, challenges: deal(seed).map((c) => c.id) };
}

/** "Whoever reaches for a phone first buys the ice cream." */
export function stakeSentence(stakeId: string): string {
  const stake = stakeById(stakeId) ?? STAKES[0]!;
  return `Whoever reaches for a phone first ${stake.owes}.`;
}
