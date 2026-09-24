/**
 * **OCTOBER PICKS, as strokes rather than letterforms.**
 *
 * No font is involved. Each letter is a handful of polylines drawn the way a
 * person scoring wood with something sharp would draw them: the stroke starts
 * before the letter does, ends past where it should, and the curves are three
 * or four straight decisions rather than a curve. Bowls do not close. Stems
 * overshoot their baseline. A few letters were gone over twice.
 *
 * The glyphs live in a 10 × 14 box with the baseline at y = 13, and are
 * positioned with uneven advances and drifting baselines so the line sags and
 * recovers the way a hand does when it is working on something vertical.
 *
 * All of it is fixed rather than random. It was scratched once, by something,
 * and it is the same every time you walk in.
 */

export type Stroke = readonly (readonly [number, number])[];

/** How hard this particular pass was leaned on. */
export interface Scratch {
  readonly points: Stroke;
  /** Plate pixels across the groove. */
  readonly width: number;
  /** 0–1. Shallow scratches barely take the wood. */
  readonly depth: number;
}

const GLYPHS: Record<string, readonly Stroke[]> = {
  // Loops that do not close, and close past where they started.
  O: [
    [
      [7.5, 1.8],
      [3.2, 2.7],
      [1.3, 6.4],
      [2.2, 11.2],
      [6.4, 13.3],
      [9.2, 10.2],
      [8.9, 5.1],
      [6.6, 2.0],
      [3.9, 2.6],
    ],
  ],
  C: [
    [
      [9.2, 2.4],
      [5.0, 1.5],
      [1.6, 5.1],
      [1.9, 10.3],
      [5.5, 13.1],
      [9.5, 11.6],
    ],
  ],
  T: [
    [
      [0.2, 2.3],
      [9.7, 1.5],
    ],
    [
      [4.7, 0.9],
      [5.4, 13.9],
    ],
  ],
  B: [
    [
      [2.0, 1.5],
      [2.4, 13.5],
    ],
    [
      [1.9, 1.9],
      [7.6, 2.3],
      [8.7, 5.0],
      [6.7, 7.2],
      [2.2, 6.9],
    ],
    [
      [2.2, 7.1],
      [8.2, 7.7],
      [9.3, 10.7],
      [6.5, 13.3],
      [2.4, 12.7],
    ],
  ],
  E: [
    [
      [2.3, 1.7],
      [1.9, 13.3],
    ],
    [
      [1.9, 2.0],
      [9.1, 1.4],
    ],
    [
      [2.2, 7.2],
      [7.3, 6.9],
    ],
    [
      [1.9, 13.0],
      [9.6, 13.5],
    ],
  ],
  R: [
    [
      [2.2, 1.5],
      [1.9, 13.7],
    ],
    [
      [2.0, 1.8],
      [7.9, 2.5],
      [8.9, 5.3],
      [6.3, 7.5],
      [2.2, 7.1],
    ],
    [
      [5.2, 7.3],
      [9.6, 13.8],
    ],
  ],
  P: [
    [
      [2.2, 1.5],
      [2.5, 13.9],
    ],
    [
      [2.1, 1.8],
      [8.1, 2.1],
      [9.1, 5.5],
      [6.1, 7.9],
      [2.4, 7.3],
    ],
  ],
  I: [
    [
      [4.7, 1.3],
      [5.3, 13.7],
    ],
    [
      [3.0, 1.9],
      [6.9, 1.5],
    ],
    [
      [3.3, 13.3],
      [7.1, 13.7],
    ],
  ],
  K: [
    [
      [2.2, 1.5],
      [1.9, 13.7],
    ],
    [
      [8.9, 1.7],
      [2.1, 7.7],
    ],
    [
      [3.3, 6.7],
      [9.4, 13.9],
    ],
  ],
  S: [
    [
      [9.1, 2.9],
      [5.0, 1.5],
      [1.9, 3.7],
      [3.1, 6.3],
      [7.5, 7.9],
      [8.9, 10.5],
      [5.9, 13.3],
      [1.7, 11.6],
    ],
  ],
};

/** `[advance, baselineDrift, lean, scale]` per position. Nothing repeats. */
const SET: readonly [number, number, number, number][] = [
  [0, 0.0, -2.4, 1.02],
  [10.6, 0.5, 1.1, 0.96],
  [21.4, -0.3, -0.8, 1.05],
  [31.6, 0.7, 2.0, 0.99],
  [42.5, 0.2, -1.5, 1.03],
  [52.9, -0.5, 0.6, 0.97],
  [63.2, 0.9, -2.1, 1.01],
  [73.9, 0, 0, 1], // the gap
  [79.4, -0.2, 1.7, 1.04],
  [90.1, 0.6, -1.0, 0.98],
  [98.6, -0.4, 2.3, 1.02],
  [108.9, 0.3, -1.8, 0.95],
  [119.2, -0.6, 0.9, 1.06],
];

const WORD = "OCTOBER PICKS";

/**
 * Letters that were gone over a second time, and by how far the second pass
 * missed. Somebody was not satisfied with these.
 */
const RETRACED: Record<number, [number, number, number]> = {
  0: [0, 0.45, -0.3],
  4: [0, -0.35, 0.5],
  9: [0, 0.3, 0.4],
  11: [1, -0.4, -0.35],
};

/**
 * Marks that are not letters: a slip on the way to one, a scratch that tails
 * off into the grain, a short jab that never became anything.
 */
const INCIDENTAL: readonly Scratch[] = [
  {
    points: [
      [17.2, 15.6],
      [23.8, 16.4],
    ],
    width: 0.38,
    depth: 0.5,
  },
  {
    points: [
      [66.5, -0.9],
      [69.2, 2.4],
    ],
    width: 0.32,
    depth: 0.42,
  },
  {
    points: [
      [95.8, 14.9],
      [97.1, 16.8],
      [101.4, 16.1],
    ],
    width: 0.3,
    depth: 0.35,
  },
  {
    points: [
      [128.4, 3.1],
      [131.6, 9.8],
    ],
    width: 0.42,
    depth: 0.6,
  },
];

/** Where the glyph grid ends, in its own units. */
export const SCRATCH_EXTENT = { width: 132, height: 18 } as const;

function place(
  stroke: Stroke,
  [dx, drift, lean, scale]: readonly [number, number, number, number],
): Stroke {
  const rad = (lean * Math.PI) / 180;
  return stroke.map(([x, y]) => {
    const sx = (x - 5) * scale;
    const sy = (y - 7) * scale;
    return [
      dx + 5 + sx + Math.sin(rad) * -sy,
      7 + drift + sy + Math.sin(rad) * sx,
    ] as const;
  });
}

/**
 * Every pass of the blade, in the order it happened. Strokes are emitted
 * letter by letter so the carving reads left to right, with the retraces
 * following the stroke they are correcting.
 */
export function carvedWord(): readonly Scratch[] {
  const out: Scratch[] = [];
  WORD.split("").forEach((glyph, i) => {
    const shapes = GLYPHS[glyph];
    const seat = SET[i]!;
    if (!shapes) return;
    shapes.forEach((stroke, s) => {
      // Vertical stems take more weight than the strokes across them.
      const vertical =
        Math.abs(stroke[stroke.length - 1]![1] - stroke[0]![1]) >
        Math.abs(stroke[stroke.length - 1]![0] - stroke[0]![0]);
      out.push({
        points: place(stroke, seat),
        width: vertical ? 0.78 : 0.6,
        depth: vertical ? 0.95 : 0.78,
      });
      const again = RETRACED[i];
      if (again && again[0] === s) {
        out.push({
          points: place(stroke, [
            seat[0] + again[1],
            seat[1] + again[2],
            seat[2] * 0.6,
            seat[3],
          ]),
          width: 0.52,
          depth: 0.7,
        });
      }
    });
  });
  return [...out, ...INCIDENTAL];
}
