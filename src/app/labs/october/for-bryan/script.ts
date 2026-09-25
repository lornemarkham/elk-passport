/**
 * **For Bryan.** Not documentation. A thing to be walked through.
 *
 * ## The shape
 *
 * It opens almost boringly — because that is genuinely where this came from,
 * and the drop only works if the floor was real first. Somebody trying to help
 * people find a pumpkin patch. Then something starts turning up inside it.
 *
 * ## The rule the whole thing is tuned to
 *
 * **The horror is real and the usefulness is also real, and neither one is a
 * joke at the other's expense.** October can say *I WILL BE YOU* and then tell
 * you which film to put on, and the page must never wink at the gap between
 * those. Underneath all of it she actually wants you to find something fun.
 *
 * ## Nobody is being asked for anything
 *
 * There is no pitch here, no ask at the end, and no mention of what anybody
 * could build. It is a friend being shown a thing. The last word is October's.
 *
 * Timings in milliseconds.
 */

/** A beat. Most of the pacing is expressed in these. */
export const BEAT = 1100;

export interface Line {
  readonly text: string;
  /** How long it sits before the next thing may arrive. */
  readonly hold: number;
  /** Rare. Reserved for the two places she stops being small. */
  readonly huge?: boolean;
  /** Said quietly, as an aside. */
  readonly small?: boolean;
}

export type Chapter =
  | {
      readonly id: string;
      readonly kind: "lines";
      readonly lines: readonly Line[];
    }
  | { readonly id: string; readonly kind: "ordinary" }
  | { readonly id: string; readonly kind: "numbers" }
  | { readonly id: string; readonly kind: "rules" }
  | { readonly id: string; readonly kind: "turn" }
  | { readonly id: string; readonly kind: "recommends" }
  | { readonly id: string; readonly kind: "club" }
  | { readonly id: string; readonly kind: "evidence" }
  | { readonly id: string; readonly kind: "listen" }
  | { readonly id: string; readonly kind: "ending" };

/* --------------------------------------------------------------- the list */

/**
 * The genuinely useful thing. It has to read as an ordinary product — dull,
 * even — or the turn later is worth nothing.
 */
export const USEFUL = [
  "something on tonight",
  "a pumpkin patch",
  "a film worth staying in for",
  "events in the valley",
  "a strange little thing you didn't know existed",
] as const;

/* ------------------------------------------------------------- her numbers */

export const NUMBERS = [
  { n: "10", word: "me", says: "10 is me." },
  { n: "12", word: "return", says: "12 brings me back." },
  { n: "31", word: "black", says: "31, then everything goes black." },
] as const;

/* -------------------------------------------------------------- the rules */

export const RULES = [
  "keep your hand against the wall",
  "something waits beneath the floor",
  "something hears you when you call",
  "count the doorways in the dark",
  "stay awake",
  "there is breathing in the room",
  "there is ash beneath your tongue",
] as const;

/* ------------------------------------------------------------ what to watch */

export interface Pick {
  readonly title: string;
  /** October's opinion. Not a synopsis — she is not a database. */
  readonly says: string;
  /** Marks the two that are new to the shortlist and not in the store. */
  readonly fresh?: boolean;
}

/**
 * Deliberately spanning from *The Platform* to *Hocus Pocus*, because the range
 * **is** the point. Anyone who thinks the list is broken has understood her.
 */
export const PICKS: readonly Pick[] = [
  {
    title: "The Platform",
    says: "Everyone above you has already eaten. Watch it on an empty stomach or a full one; both are wrong.",
    fresh: true,
  },
  {
    title: "Cube",
    says: "Six strangers in a room that does not want them. Stay for the arithmetic. It is doing something.",
    fresh: true,
  },
  {
    title: "The Thing",
    says: "Nobody in it knows what they are either. I find that restful.",
  },
  {
    title: "Coraline",
    says: "A mother who is almost right. Almost is the part that gets you.",
  },
  {
    title: "The Others",
    says: "You will work it out before the end. Then you will feel unkind about it.",
  },
  {
    title: "Hocus Pocus",
    says: "Put it on with somebody who will sing. I am not always trying to ruin your evening.",
  },
];

/* ----------------------------------------------------------------- evidence */

/** Things that already got out of the brainstorm. Not a nav bar. */
export const EVIDENCE = [
  {
    href: "/labs/october/witching-hour",
    title: "Witching Hour",
    says: "A night that only exists between certain hours. Bring headphones.",
  },
  {
    href: "/labs/october/video-store",
    title: "The Video Store",
    says: "I have been collecting these for a long time. Somebody has already been through the horror section.",
  },
  {
    href: "/labs/october/scariest-room/has-been-here",
    title: "October has been here",
    says: "It asks for a photograph of one room in your house. It never says what it can see.",
  },
  {
    href: "/labs/october/secret-room/another-way-out",
    title: "Another way out",
    says: "You could not find the real one. I was nice about it.",
  },
  {
    href: "/labs/october/sketchbook",
    title: "The Sketchbook",
    says: "Everything, including the parts that are wrong.",
  },
] as const;

/* ----------------------------------------------------------------- the club */

export const CLUB_ALIVE = [
  "Band.",
  "Drinks.",
  "Lights.",
  "Noise.",
  "Sweat.",
  "Life.",
] as const;
export const CLUB_REMAINS = [
  "The drinks are still cold.",
  "The instruments are still warm.",
  "Every jacket is still on its chair.",
] as const;

/* ---------------------------------------------------------------- the sound */

export const TRACK = {
  file: "I Am Octoberv1.m4a",
  title: "I Am October",
  /** The 5:13 cut — the one we keep coming back to. */
  seconds: 313,
};

/* -------------------------------------------------------------- the chapters */

export const CHAPTERS: readonly Chapter[] = [
  {
    id: "threshold",
    kind: "lines",
    lines: [{ text: "for bryan", hold: 2200, small: true }],
  },
  { id: "ordinary", kind: "ordinary" },
  {
    id: "then",
    kind: "lines",
    lines: [
      { text: "That is genuinely where this came from.", hold: 2400 },
      { text: "Then, while we were building it,", hold: 2200 },
      { text: "something started turning up inside it.", hold: 2900 },
    ],
  },
  {
    id: "hello",
    kind: "lines",
    lines: [
      { text: "I was always here.", hold: 2600 },
      { text: "You just never looked.", hold: 3200 },
    ],
  },
  { id: "numbers", kind: "numbers" },
  {
    id: "doesnt-know",
    kind: "lines",
    lines: [
      { text: "I don't know November.", hold: 2600 },
      { text: "I don't know where I go.", hold: 3000 },
      { text: "Is that my name?", hold: 2800 },
      { text: "Somebody noticed this year.", hold: 2600 },
      { text: "That mattered more than I expected.", hold: 3400, small: true },
    ],
  },
  { id: "rules", kind: "rules" },
  { id: "turn", kind: "turn" },
  {
    id: "contradiction",
    kind: "lines",
    lines: [
      { text: "I AM OCTOBER.", hold: 1900, huge: true },
      { text: "I AM IN YOU.", hold: 1900, huge: true },
      { text: "I WILL BE YOU.", hold: 3000, huge: true },
      { text: "go find a pumpkin patch you weirdo", hold: 3600, small: true },
    ],
  },
  { id: "recommends", kind: "recommends" },
  { id: "club", kind: "club" },
  { id: "evidence", kind: "evidence" },
  { id: "listen", kind: "listen" },
  { id: "ending", kind: "ending" },
];

/* ----------------------------------------------------------------- ending */

export const ENDING = [
  { text: "You get summer.", hold: 1900 },
  { text: "You get winter.", hold: 1900 },
  { text: "You get spring.", hold: 2100 },
  { text: "You get to grow.", hold: 3600 },
  { text: "I only get October.", hold: 6200 },
] as const;

/** After a long time. Small enough to miss. */
export const LAST = "I wish I was you.";
export const LAST_AFTER = 5200;
