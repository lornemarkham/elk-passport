import { createNoise2D, createNoise3D, type RandomFn } from "simplex-noise";

/**
 * A tiny deterministic PRNG (mulberry32) so each phenomenon instance gets
 * its own noise field that looks different from its neighbors but is
 * reproducible across a render — not reseeded from `Math.random()` on every
 * mount, which would make two Campfire cards on the same field drift in and
 * out of sync in a way that reads as coincidental rather than designed.
 */
function mulberry32(seed: number): RandomFn {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * One seeded 2D+3D noise field, shared by every phenomenon that needs
 * organic, continuous randomness — fire flicker, ember drift, glow
 * breathing. The point of routing everything through one field type is
 * that "sample continuously" becomes the only way any of this codebase's
 * organic motion is produced; nothing here should ever fall back to
 * `Math.random()` per frame, which is what reads as static rather than
 * weather.
 */
export class NoiseField {
  private readonly noise2D: ReturnType<typeof createNoise2D>;
  private readonly noise3D: ReturnType<typeof createNoise3D>;

  constructor(seed: number) {
    const random = mulberry32(seed);
    this.noise2D = createNoise2D(random);
    this.noise3D = createNoise3D(random);
  }

  /** Raw sample, [-1, 1]. */
  get2D(x: number, y: number): number {
    return this.noise2D(x, y);
  }

  /** Raw sample, [-1, 1]. Third axis is almost always time. */
  get3D(x: number, y: number, z: number): number {
    return this.noise3D(x, y, z);
  }

  /** Normalized sample, [0, 1] — the common case for driving opacity/scale. */
  get01(x: number, y: number, z: number): number {
    return (this.noise3D(x, y, z) + 1) / 2;
  }
}

let seedCounter = 1;

/** A fresh, distinct seed each call — stable for the lifetime of whatever
 * calls it once (e.g. inside a `useState(() => ...)` lazy initializer). */
export function nextNoiseSeed(): number {
  seedCounter += 104729; // a prime step, so consecutive seeds aren't visually correlated
  return seedCounter;
}
