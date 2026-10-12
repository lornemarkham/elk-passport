/**
 * **October Has Been Here — the shot list.**
 *
 * One reading of *The Scariest Room in Your House*, written as timing rather
 * than as prose, because timing is the whole thing. October says eight short
 * sentences in about a minute; everything else it does, it does by waiting.
 *
 * ## The rule this cut was written against
 *
 * Witching Hour's first screening taught us that _a pause is earned by what
 * came just before it_ — an empty wait reads as "is this broken?", not as
 * dread. So the one genuinely long silence here (`LOOKING`, eleven and a half
 * seconds) is the only place where the screen is *full*: the person's own room
 * is sitting there, lit, breathing. The wait has something to be about.
 *
 * Every other gap is short enough to read as a person choosing their words.
 *
 * ## What October is not allowed to do
 *
 * It never says what it can see. There is no analysis here, no recognition,
 * nothing that could be checked against the photograph — and that is a design
 * constraint, not a limitation we are working around. The moment October
 * identifies the water heater, it stops being a presence and becomes a party
 * trick, and the person's own imagination — which is doing all the real work —
 * gets switched off.
 *
 * All milliseconds.
 */

/** Black, before anything. Long enough to stop expecting a page. */
export const OPEN_DARK = 1600;

/**
 * The approach. One line at a time, alone on black, each one leaving before
 * the next arrives — so the gaps between them are part of the speech rather
 * than a gap in the layout.
 *
 * `hold` is how long the line sits at full opacity before it begins to go.
 */
export const LINES: readonly {
  readonly text: string;
  readonly hold: number;
}[] = [
  { text: "Hello.", hold: 1700 },
  { text: "I want to try something.", hold: 2000 },
  { text: "Think about your house.", hold: 2100 },
  /** The question. It gets the longest hold of the opening — it is the one
   *  the person has to actually answer, and they answer it in their head
   *  before they answer it with the camera. */
  { text: "Which room do you like least after dark?", hold: 3000 },
  /** Not in the original rhythm, and the strongest line in the opening.
   *  October claims no knowledge of the house and instead says something
   *  true of everybody — which is far more unsettling than a guess, because
   *  it cannot be wrong. */
  { text: "You already know which one.", hold: 2600 },
  { text: "Show me.", hold: 0 },
];

/** Fade in / fade out for an approach line, and the black between two. */
export const LINE_IN = 900;
export const LINE_OUT = 700;
export const LINE_GAP = 420;

/** After "Show me." lands, before the way to answer it appears. */
export const CONTROL_DELAY = 1100;

/** The photograph coming up out of the dark. Slow enough to feel developed. */
export const PHOTO_IN = 3000;

/**
 * **The long look.** Nothing is said, nothing is asked, nothing indicates
 * progress. The room breathes and the vignette pulses, and that is all.
 *
 * This number is the experiment. Too short and October glanced; too long and
 * the person leaves. Eleven and a half seconds is roughly where an unprompted
 * silence stops reading as latency and starts reading as attention.
 */
export const LOOKING = 11_500;

/**
 * What October says, from the moment the photograph starts to appear.
 *
 * `stay` marks the line that does not leave. Everything before it is spoken
 * and withdrawn; this one is left on the screen, over their room, for as long
 * as the scene has left — because a line that exits politely is a line the
 * person is finished with.
 */
export const SPOKEN: readonly {
  readonly text: string;
  readonly at: number;
  readonly hold: number;
  readonly stay?: boolean;
}[] = [
  { text: "Oh.", at: PHOTO_IN + LOOKING, hold: 2400 },
  { text: "Yes.", at: 17_400, hold: 3200 },
  {
    text: "October spent many years here.",
    at: 24_100,
    hold: 9400,
    stay: true,
  },
];

/** The room going back down into the dark, underneath the last line. */
export const DIM_AT = 29_600;
export const DIM_MS = 7000;

/** Small, and after the line has gone. It is not a summary of anything. */
export const THANKS_AT = 36_400;

/**
 * The way out, last of all and deliberately late — leaving has to be the
 * person's own idea, and an exit offered too early reads as permission.
 */
export const EXIT_AT = 39_800;
