/**
 * **Another Way Out — what October says, and when.**
 *
 * A toy. One room, one exit, one small game standing in the doorway.
 *
 * ## The tone this is written to
 *
 * October is not punishing anybody here. The person failed to find the real
 * way out, and October — mildly, and without being asked — offers a different
 * one. That makes *\"October is being nice to you. This time.\"* land as funny
 * and ominous and genuinely generous all at once, which is the note the whole
 * scene is tuned to. Nothing in here should read as a threat, and nothing
 * should read as a tutorial either.
 *
 * The game is allowed to simply be fun. The situation around it supplies all
 * the strangeness it needs.
 *
 * All milliseconds.
 */

/**
 * How long the room is yours before October says anything.
 *
 * Short on purpose. The looking-around has to be real enough that being stuck
 * is the person's own experience rather than something they are told about —
 * but a locked room stops being interesting the moment it becomes tedious, and
 * October arrives well before that. Touching four things ends it early, since
 * somebody who has tried four things has understood the situation.
 */
export const LOOK_MS = 16_000;
export const LOOK_TOUCHES = 4;

/** Things in the room, and what they turn out to be worth. */
export const HOTSPOTS: readonly {
  readonly id: string;
  readonly label: string;
  /** Percent of the stage. */
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly says: string;
}[] = [
  {
    id: "door",
    label: "The door",
    x: 40,
    y: 26,
    w: 20,
    h: 48,
    says: "Locked. You did check.",
  },
  {
    id: "switch",
    label: "A light switch",
    x: 64.5,
    y: 46,
    w: 4,
    h: 6,
    says: "The switch does nothing. You knew that.",
  },
  {
    id: "mirror",
    label: "Something reflective",
    x: 17,
    y: 34,
    w: 13,
    h: 18,
    says: "Just you.",
  },
  {
    id: "shelf",
    label: "A shelf",
    x: 74,
    y: 38,
    w: 18,
    h: 5,
    says: "Empty, and always was.",
  },
  {
    id: "rug",
    label: "A rug",
    x: 26,
    y: 76,
    w: 26,
    h: 12,
    says: "Nothing under it.",
  },
];

/** A line spoken alone, over the dark. */
export interface Line {
  readonly text: string;
  readonly hold: number;
}

/** The intervention. Unhurried — October is not in any trouble. */
export const OFFER: readonly Line[] = [
  { text: "You haven't found it.", hold: 2000 },
  { text: "That's all right.", hold: 1800 },
  { text: "I'll give you another way out.", hold: 2400 },
  { text: "October is being nice to you.", hold: 2100 },
  /** The whole joke, and the whole threat. It gets its own silence. */
  { text: "This time.", hold: 2700 },
  { text: "Keep it alight.", hold: 1900 },
];

/** Said after the flame goes out. Amused, not cruel. It costs nothing. */
export const FAILED: readonly Line[] = [
  { text: "Oh dear.", hold: 1700 },
  { text: "Again.", hold: 1500 },
];

/**
 * The reward. Two lines and no more.
 *
 * The second one is doing quiet double duty: it is a small joke, and it keeps
 * the idea that a *real* exit was in the room the whole time — which is the
 * part of the Secret Room worth protecting, and the reason October's games are
 * alternates rather than the thing itself.
 */
export const OPENED: readonly Line[] = [
  { text: "The door opens.", hold: 2600 },
  { text: "The real one was nicer.", hold: 3400 },
];

/** Fades, and the black between two lines. */
export const LINE_IN = 900;
export const LINE_OUT = 700;
export const LINE_GAP = 420;

/** How long the flame has to survive. */
export const SURVIVE_MS = 30_000;
