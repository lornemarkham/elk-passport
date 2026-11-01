import type { ThemeId } from "./themes";

/**
 * **Christmas challenges: small dares that get people off the couch.**
 *
 * Optional, never scored against anyone's will, and only ever completed in
 * the real world — a challenge is finished by sharing what happened (a photo
 * or a line), which then becomes one of the group's memories. There is no
 * second "done" state to drift from the memory it describes (doctrine §6:
 * shared challenges that enhance the real experience; §14 keeps elaborate
 * social games out of scope, so this stays a short deck and a tally).
 *
 * These are Passport's own words, not facts about any place: no challenge
 * names a business, promises a price or says something is open.
 */

export type Proof = "photo" | "words" | "either";

export interface Challenge {
  readonly id: string;
  readonly title: string;
  /** The dare, said to the whole group. */
  readonly dare: string;
  readonly proof: Proof;
  /** Finds of this kind help — the card can point at them. */
  readonly theme?: ThemeId;
  /** Lovely with small children. */
  readonly kids?: true;
  readonly emoji: string;
}

export const CHALLENGES: readonly Challenge[] = [
  {
    id: "best-lights",
    title: "Find the best Christmas lights",
    dare: "Out of everything you see this season, which lights win? Photo or it didn't happen.",
    proof: "photo",
    theme: "lights",
    kids: true,
    emoji: "✨",
  },
  {
    id: "new-treat",
    title: "Try a holiday treat nobody's had",
    dare: "Stollen, a mince tart, a pretzel the size of your head, egg nog. Something none of you has tasted — then tell everyone the verdict.",
    proof: "either",
    theme: "food",
    emoji: "🍪",
  },
  {
    id: "market",
    title: "Discover a Christmas market",
    dare: "One you've never been to. Bring home one small thing made by the person who sold it.",
    proof: "either",
    theme: "markets",
    emoji: "🎪",
  },
  {
    id: "tradition",
    title: "Keep a family tradition",
    dare: "The thing you always do. Do it — and write down why it's yours.",
    proof: "words",
    kids: true,
    emoji: "🕯️",
  },
  {
    id: "new-tradition",
    title: "Start a new tradition",
    dare: "Something you've never done at Christmas. If you'd do it again next year, it's a tradition now.",
    proof: "words",
    emoji: "🌟",
  },
  {
    id: "group-photo",
    title: "Take the group photo",
    dare: "Everyone in it. Yes, including whoever always takes it.",
    proof: "photo",
    kids: true,
    emoji: "📸",
  },
  {
    id: "santa-question",
    title: "Ask Santa something new",
    dare: "The youngest asks Santa a question he has never been asked. Write down his answer.",
    proof: "words",
    theme: "santa",
    kids: true,
    emoji: "🎅",
  },
  {
    id: "carol",
    title: "Sing one out loud",
    dare: "One carol, every verse you know, somewhere other than the shower. The car counts.",
    proof: "either",
    theme: "shows",
    kids: true,
    emoji: "🎶",
  },
  {
    id: "hot-chocolate",
    title: "Rank the hot chocolate",
    dare: "Every hot chocolate this season gets a score out of ten. Post the leader.",
    proof: "either",
    theme: "food",
    kids: true,
    emoji: "☕",
  },
  {
    id: "on-the-ice",
    title: "Get on the ice",
    dare: "One lap counts. Holding the wall counts. Falling over and laughing counts double.",
    proof: "either",
    theme: "winter",
    kids: true,
    emoji: "⛸️",
  },
  {
    id: "make-something",
    title: "Make something for the tree",
    dare: "An ornament, a paper chain, a slightly alarming gingerbread person. Show it.",
    proof: "photo",
    kids: true,
    emoji: "🎄",
  },
  {
    id: "kindness",
    title: "A bit of Christmas for a stranger",
    dare: "Hold a door, buy a coffee, clear a neighbour's walk. Don't post who — just say it was done.",
    proof: "words",
    emoji: "💛",
  },
];

export const challengeById = (id: string | null | undefined) =>
  id ? CHALLENGES.find((c) => c.id === id) : undefined;

/** Which proof a share satisfies. */
export function satisfies(
  challenge: Challenge,
  share: { readonly text?: string | null; readonly hasPhoto: boolean },
): boolean {
  const words = Boolean(share.text?.trim());
  switch (challenge.proof) {
    case "photo":
      return share.hasPhoto;
    case "words":
      return words;
    case "either":
      return words || share.hasPhoto;
  }
}

/** What the share box asks for, in a few words. */
export function proofAsk(proof: Proof): string {
  switch (proof) {
    case "photo":
      return "Add the photo";
    case "words":
      return "Say what happened";
    case "either":
      return "A photo or a line";
  }
}
