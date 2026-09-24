/**
 * **The world remembers your touch.**
 *
 * A tape you have handled does not go back the way it came. It settles a
 * fraction off where it was — a little to one side, a degree out of true, a
 * little deeper in the cavity — because that is what happens when a person
 * puts something back on a shelf.
 *
 * Three rules keep it from becoming an effect:
 *
 * 1. **It is caused, not scheduled.** A tape only moves because you moved it.
 *    Nothing on this wall drifts on its own.
 * 2. **It is deterministic.** The same tape, handled the same number of
 *    times, settles in exactly the same place. This is memory, not wobble.
 * 3. **It is bounded.** Each return adds less than the one before, and the
 *    total is clamped well inside the cavity, so a tape handled twenty times
 *    is visibly *used* and still plainly on its shelf and still exactly where
 *    you reach for it — the hit target never moves, because all of this lives
 *    in the transform rather than in the layout.
 */
export interface Touch {
  /** Plate pixels off true, sideways. */
  readonly dx: number;
  /** Degrees out of true. */
  readonly da: number;
  /** Plate pixels further back in the cavity. */
  readonly dz: number;
  readonly times: number;
}

export const UNTOUCHED: Touch = { dx: 0, da: 0, dz: 0, times: 0 };

const LIMIT = { dx: 2.3, da: 1.9, dz: 3.6 } as const;

/** Stable per tape and per handling, so the shelf is never twice-surprising. */
function jitter(id: string, times: number, salt: number): number {
  let h = salt * 2654435761;
  const key = `${id}:${times}`;
  for (let i = 0; i < key.length; i += 1) {
    h = (h ^ key.charCodeAt(i)) * 16777619;
    h >>>= 0;
  }
  return (h % 2000) / 1000 - 1;
}

/**
 * What handling a tape once more leaves behind. The step shrinks as the count
 * rises, so the first return is the one you would notice and the twentieth
 * barely moves anything.
 */
export function handled(id: string, prior: Touch = UNTOUCHED): Touch {
  const times = prior.times + 1;
  const fade = 1 / (1 + prior.times * 0.85);
  const clamp = (v: number, max: number) => Math.max(-max, Math.min(max, v));
  return {
    dx: clamp(prior.dx + jitter(id, times, 1) * 1.15 * fade, LIMIT.dx),
    da: clamp(prior.da + jitter(id, times, 2) * 0.95 * fade, LIMIT.da),
    // Always a little further in. Nobody ever puts a tape back proud.
    dz: Math.min(
      prior.dz + (0.5 + Math.abs(jitter(id, times, 3)) * 1.1) * fade,
      LIMIT.dz,
    ),
    times,
  };
}
