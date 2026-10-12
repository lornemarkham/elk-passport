/**
 * **The Secret Room — the puzzle, as rules.**
 *
 * Everything the room *decides* lives here, so it can be tested without a
 * browser. Everything it *looks and sounds like* lives in
 * `components/october/room`.
 *
 * ## The puzzle
 *
 * The door has three wheels. The code is in the room, and the room tells you
 * where, if you can find the radio and tune it:
 *
 * ```
 * 89.7   "First. How many bars keep the moon out?"        the window     → 4
 * 95.3   "Second. The clock stopped. What was the hour?"  the clock      → 7
 * 101.1  "Third. Count what was taken from the wall."     pale marks     → 2
 * ```
 *
 * A fourth station, at 106.9, is October's, and it lies. It is the only one
 * that is perfectly clear, which is the tell — and it is the first thing
 * everybody believes.
 *
 * The answer is **4-7-2**. It is not 7-7-7.
 */

export const CODE = [4, 7, 2] as const;

/** What the room itself contains. The scene draws these and nothing else. */
export const WINDOW_BARS = CODE[0];
export const CLOCK_HOUR = CODE[1];
export const CLOCK_MINUTE = 20;
export const MISSING_PICTURES = CODE[2];

export const DIAL_MIN = 88;
export const DIAL_MAX = 108;
/** How far either side of a station the voice is clear enough to read. */
export const CLEAR_WITHIN = 0.35;
/** How far either side it is merely a voice somewhere in the noise. */
export const HEARD_WITHIN = 1.4;

export interface Station {
  readonly id: "bars" | "hour" | "taken" | "october";
  readonly at: number;
  readonly text: string;
  /** Which wheel it is about, or `null` for the one that lies. */
  readonly wheel: 0 | 1 | 2 | null;
}

export const STATIONS: readonly Station[] = [
  {
    id: "bars",
    at: 89.7,
    text: "First. How many bars keep the moon out?",
    wheel: 0,
  },
  {
    id: "hour",
    at: 95.3,
    text: "Second. The clock stopped. What was the hour?",
    wheel: 1,
  },
  {
    id: "taken",
    at: 101.1,
    text: "Third. Count what was taken from the wall.",
    wheel: 2,
  },
  {
    id: "october",
    at: 106.9,
    text: "Seven. Seven. Seven. That is all of it. Trust me.",
    wheel: null,
  },
];

export interface Reception {
  readonly station: Station | null;
  /** 0 = noise, 1 = a clear voice. */
  readonly clarity: number;
  /** 0–1: how loud the static should be. Gone at a station, full between. */
  readonly static: number;
}

/** What the radio does at this setting of the dial. */
export function receive(frequency: number): Reception {
  let best: Station | null = null;
  let bestGap = Infinity;
  for (const s of STATIONS) {
    const gap = Math.abs(s.at - frequency);
    if (gap < bestGap) {
      best = s;
      bestGap = gap;
    }
  }
  if (!best || bestGap > HEARD_WITHIN) {
    return { station: null, clarity: 0, static: 1 };
  }
  if (bestGap <= CLEAR_WITHIN) {
    return { station: best, clarity: 1, static: 0.04 };
  }
  const t = 1 - (bestGap - CLEAR_WITHIN) / (HEARD_WITHIN - CLEAR_WITHIN);
  return { station: best, clarity: t * 0.5, static: 1 - t * 0.7 };
}

export type Wheels = readonly [number, number, number];

export function checkCode(guess: Wheels): {
  readonly open: boolean;
  /** Which wheels are right. Only ever shown once October chooses to. */
  readonly right: readonly [boolean, boolean, boolean];
} {
  const right = guess.map((d, i) => d === CODE[i]) as unknown as [
    boolean,
    boolean,
    boolean,
  ];
  return { open: right.every(Boolean), right };
}

/** The wheels everybody tries first. October has opinions about them. */
export function obviousGuess(guess: Wheels): "liar" | "date" | "zeros" | null {
  const [a, b, c] = guess;
  if (a === 7 && b === 7 && c === 7) return "liar";
  if (a === 3 && b === 1 && c === 0) return "date";
  if (a === 0 && b === 0 && c === 0) return "zeros";
  return null;
}

export interface Verdict {
  readonly line: string;
  /** October chose to show which wheels are right. */
  readonly reveal: boolean;
}

/**
 * What October says to a wrong code, given how many wrong codes there have
 * been. It is dry about the obvious ones, and from the third failure it starts
 * to help — because a locked room stops being interesting the moment it
 * becomes tedious.
 */
export function verdictFor(guess: Wheels, wrong: number): Verdict {
  const obvious = obviousGuess(guess);
  const { right } = checkCode(guess);
  const count = right.filter(Boolean).length;

  if (obvious === "liar") {
    return { line: "Everyone believes that one.", reveal: false };
  }
  if (obvious === "date") {
    return { line: "No. Not that date.", reveal: false };
  }
  if (obvious === "zeros") {
    return { line: "Locked. You did check.", reveal: false };
  }
  if (wrong >= 4) {
    return { line: "Look. The ones that catch are right.", reveal: true };
  }
  if (wrong >= 2) {
    return {
      line:
        count === 0
          ? "Nothing. Not one of them."
          : count === 1
            ? "One of them is right. I'm only telling you that once."
            : "Two. You're close. I'm trying not to say so.",
      reveal: false,
    };
  }
  return { line: "Locked.", reveal: false };
}

export function clamp(frequency: number): number {
  return Math.min(DIAL_MAX, Math.max(DIAL_MIN, frequency));
}

/**
 * A voice that is not quite there. Letters drop out of the line in a fixed
 * order — never random, so the same dial position always shows the same
 * fragment and the person can *chase* a word rather than watch noise.
 */
export function garble(text: string, clarity: number): string {
  if (clarity >= 1) return text;
  const keep = Math.max(0, Math.min(1, clarity));
  return [...text]
    .map((ch, i) => {
      if (ch === " " || ch === "." || ch === "?") return ch;
      // A fixed, scattered threshold per character.
      const threshold = ((i * 37 + 11) % 97) / 97;
      return threshold < keep * 0.9 ? ch : "·";
    })
    .join("");
}
