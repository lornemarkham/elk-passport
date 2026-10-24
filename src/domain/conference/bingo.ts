/**
 * **Get-to-know-you Bingo — Passport's optional game, not the organiser's.**
 *
 * Nine squares, each a small, low-pressure way to meet somebody. The
 * person marks their own card on their own phone; nothing is sent, scored
 * against anybody else or ranked, and no square asks for anything
 * sensitive — no names typed, no photos, no details about the person met.
 *
 * The squares are Passport's suggestions. If the agenda has an official
 * Bingo, the organiser's rules are theirs; this card says it is separate.
 */

export const SQUARES: readonly string[] = [
  "Meet someone from another team",
  "Find someone who travelled from another province or state",
  "Learn something surprising about a coworker's job",
  "Meet someone you've only seen on video calls",
  "Find someone who shares a hobby with you",
  "Swap a favourite Vancouver tip",
  "Find someone who started the same year as you",
  "Ask someone what they're most excited about this year",
  "Find someone who's been here before",
  "Trade a book, podcast or show recommendation",
  "Meet someone whose job you'd like to understand better",
  "Find someone who arrived on the same day as you",
  "Learn a coworker's go-to coffee order",
  "Find someone who speaks another language",
  "Thank someone for something they did this year",
  "Find someone with a pet — get the name",
];

/** A small seeded shuffle: the same person gets the same card every time. */
function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return (h >>> 0) / 4294967296;
  };
}

/** Nine squares for this person, by index into `SQUARES`, stable per seed. */
export function cardFor(seed: string): number[] {
  const next = rng(seed);
  const idx = SQUARES.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [idx[i], idx[j]] = [idx[j]!, idx[i]!];
  }
  return idx.slice(0, 9);
}

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

/** How many rows, columns and diagonals are complete (positions 0–8). */
export function linesDone(marked: ReadonlySet<number>): number {
  return LINES.filter((l) => l.every((p) => marked.has(p))).length;
}
