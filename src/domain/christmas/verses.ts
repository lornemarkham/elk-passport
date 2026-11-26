/**
 * **The words by the fire** (owner brief M1127, "Stay Awhile").
 *
 * The Christmas hero says one short thing at a time, fading from one to the
 * next: our own welcome, then a line of a traditional carol, then our own
 * again. Every carol line is from a text in the public domain (all written
 * before 1870), and says which carol it is from. Nothing here asks anything
 * of anybody.
 */
export type Verse = {
  readonly text: string;
  /** The carol a line is from. Our own words carry none. */
  readonly carol?: string;
};

export const VERSES: readonly Verse[] = [
  { text: "Come on in. Stay awhile." },
  { text: "All is calm, all is bright.", carol: "Silent Night" },
  { text: "The world can wait a little." },
  {
    text: "A thrill of hope, the weary world rejoices.",
    carol: "O Holy Night",
  },
  { text: "Pull a chair up to the fire. There's no rush tonight." },
  {
    text: "Star of wonder, star of night, star with royal beauty bright.",
    carol: "We Three Kings",
  },
  { text: "The people we love, a warm fire, the snow. That's plenty." },
  {
    text: "The hopes and fears of all the years are met in thee tonight.",
    carol: "O Little Town of Bethlehem",
  },
  { text: "Stay as long as you like." },
  { text: "O night divine.", carol: "O Holy Night" },
  { text: "Wherever you are tonight, you're welcome here." },
  {
    text: "Peace on earth, and mercy mild.",
    carol: "Hark! The Herald Angels Sing",
  },
];

/** How long each line stays, in milliseconds, before the next fades in. */
export const VERSE_MS = 7000;
