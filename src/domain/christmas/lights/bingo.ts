/**
 * **Christmas Lights Bingo** — a car game for the tour. Every square is
 * something to spot from the street; none asks for a photo of a home or a
 * person. Marked on the phone that plays it; nothing is sent anywhere.
 */

export const SQUARES = [
  "A giant Santa",
  "Five reindeer",
  "A snowman",
  "A house with music",
  "A Christmas train",
  "Colourful lights",
  "A giant candy cane",
  "An inflatable anything",
  "Blue lights only",
  "A star on a roof",
  "Lights on a tree trunk",
  "A nativity scene",
  "Santa's sleigh",
  "A lit-up wreath",
  "Twinkling white lights",
  "A gingerbread house",
  "A penguin",
  "Lights spelling a word",
  "Icicle lights",
  "A Grinch",
  "A lit-up arch",
  "A polar bear",
  "Lights that change colour",
  "A Christmas tree in a window",
  "An elf",
  "A present taller than you",
  "A moving decoration",
  "A lit-up angel",
  "Candy-cane stripes on a path",
  "A countdown to Christmas",
] as const;

export const FREE = "Hot chocolate! (free square)";

/** A small, fast, seeded shuffle, so a shared card is the same card. */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4_294_967_296;
  };
}

/** A 5×5 card: 24 squares from the list and the free square in the middle. */
export function card(seed: number): string[] {
  const r = rng(seed);
  const pool = [...SQUARES];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  const picked: string[] = pool.slice(0, 24);
  picked.splice(12, 0, FREE);
  return picked;
}

const LINES: number[][] = [
  ...[0, 1, 2, 3, 4].map((r) => [0, 1, 2, 3, 4].map((c) => r * 5 + c)),
  ...[0, 1, 2, 3, 4].map((c) => [0, 1, 2, 3, 4].map((r) => r * 5 + c)),
  [0, 6, 12, 18, 24],
  [4, 8, 12, 16, 20],
];

/** Completed lines, given the marked squares (the free square always counts). */
export function lines(marked: ReadonlySet<number>): number[][] {
  return LINES.filter((line) => line.every((i) => i === 12 || marked.has(i)));
}

export function seedFrom(value: string | undefined): number {
  const n = Number(value);
  if (Number.isInteger(n) && n > 0 && n < 2 ** 31) return n;
  return 0;
}
