import type { Placement } from "./wallTapes";

/**
 * **How much of a shove reaches a given tape.**
 *
 * Energy through objects, not an animation run down a list. It falls off with
 * distance from the cavity that was hit and dies out entirely three cubbies
 * away, so most of the wall does nothing at all. What is left is shaped by the
 * tape itself — a case already leaning takes it differently from one seated
 * square, and one shoved deep into its cavity has less room to move — which is
 * what stops the survivors moving as a group.
 *
 * Deterministic on purpose. The same shove always rearranges the same shelf
 * the same way, because it is a physical consequence and not a die roll.
 */
export interface Kick {
  /** Degrees, signed. Zero means this tape does not visibly move. */
  readonly angle: number;
  /** Plate pixels knocked back into the cavity. */
  readonly depth: number;
  /** How long it takes to give the energy up. */
  readonly ms: number;
}

/** Beyond this many cubbies, nothing. */
export const SHOCK_RADIUS = 3;

export function kickFor(
  tape: Pick<Placement, "id" | "row" | "col" | "lean" | "seat">,
  hit: Pick<Placement, "id" | "row" | "col">,
): Kick {
  if (tape.id === hit.id) return { angle: 0, depth: 0, ms: 0 };
  // Columns are wider than rows are tall, so a neighbour to the side is
  // slightly further away than one directly above.
  const d = Math.hypot(tape.row - hit.row, (tape.col - hit.col) * 1.15);
  if (d > SHOCK_RADIUS) return { angle: 0, depth: 0, ms: 0 };
  const share = Math.max(0, 1 - d / SHOCK_RADIUS) ** 1.7;
  const bias = Math.sign(tape.lean || 1) * (0.62 + (tape.seat % 3) * 0.19);
  const angle = share * 4.6 * bias;
  const quiet = Math.abs(angle) < 0.12;
  return {
    // Below a tenth of a degree it is not movement, it is noise.
    angle: quiet ? 0 : angle,
    // Knocked back into its hole as well as sideways.
    depth: quiet ? 0 : share * 3.2,
    ms: 170 + d * 150 + (tape.seat % 4) * 45,
  };
}
