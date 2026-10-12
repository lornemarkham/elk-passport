/**
 * **What October says in the Secret Room, and how long it holds.**
 *
 * The rules are the ones the old room (`Another Way Out`) was tuned to:
 * October is not punishing anybody. It is mild, dry, occasionally generous,
 * and slightly too interested. Nothing here explains the room, and nothing
 * here is a tutorial — help arrives as a *remark*, and always a little late.
 *
 * All milliseconds.
 */

export interface Line {
  readonly text: string;
  readonly hold: number;
}

/** The first thing, in the dark, before the room. */
export const ENTER_FIRST: readonly Line[] = [
  { text: "You're already inside.", hold: 2400 },
];
export const ENTER_AGAIN: readonly Line[] = [
  { text: "You again.", hold: 1800 },
  { text: "It's smaller than you remember. It isn't.", hold: 2600 },
];

/** What each thing in the room has to say for itself. Never a number. */
export const THINGS = {
  window: "The moon, cut into pieces.",
  clock: "It stopped a long time ago. Nobody wound it.",
  wall: "Paler where the pictures were.",
  frames: "Faces. You'd rather not look for long.",
  door: "Locked. You did check.",
  radio: "It's warm. Someone was listening a minute ago.",
  tv: "Dead glass. It remembers a shape.",
  vcrEmpty: "It wants something. Not from here.",
  vcrTape: "Not yet.",
  floor: "Dust, and a clean place where a chair was.",
} as const;

/** Offered if the person has not found the radio. Help, a little late. */
export const NUDGE_RADIO: readonly Line[] = [
  { text: "You're not listening.", hold: 2200 },
];

/** October takes the dial away once, from a station that was just reached. */
export const SLIP: readonly Line[] = [{ text: "Hm. No.", hold: 1500 }];

/** The beam goes out. A hand that is not yours is on the switch. */
export const FLICKER_LINE: readonly Line[] = [
  { text: "Don't look at that one.", hold: 2000 },
];

export const OPENED: readonly Line[] = [
  { text: "The door opens.", hold: 2400 },
  { text: "You found the radio.", hold: 2200 },
  { text: "Most people trust the other station.", hold: 3000 },
  { text: "Go on.", hold: 2000 },
];

/** With the tape from the bottom shelf: the one thing October keeps. */
export const TAPE_PLAYS: readonly Line[] = [
  { text: "This is the last one who stayed.", hold: 3000 },
  { text: "They were good at the radio.", hold: 2600 },
  { text: "I kept the tape. I had nothing else of theirs.", hold: 3600 },
];
export const TAPE_AFTER: readonly Line[] = [
  { text: "Thank you for taking it out of there.", hold: 3000 },
  { text: "It was lonely on the bottom shelf.", hold: 3400 },
];

export const LINE_IN = 700;
export const LINE_OUT = 500;
export const LINE_GAP = 300;

/** How long before October notices nobody has touched the radio. */
export const RADIO_NUDGE_MS = 48_000;
/** How long a station must be held, clear, before October takes the dial. */
export const SLIP_AFTER_MS = 3200;
/** When the beam is first taken from the person. */
export const FLICKER_AT_MS = 24_000;
