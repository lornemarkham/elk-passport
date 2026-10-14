/**
 * **How much of the wall a screen can see, and where the head starts.**
 *
 * The stage is the plate scaled to *cover* the viewport, so the screen's
 * shape decides how much of the shelving is visible. On a desktop the whole
 * unit fits and the head only wanders a few pixels with the pointer. On a
 * phone held upright it does not — at 390 × 844 the screen sees plate x
 * 322–532, and the shelving runs 53–527 — so the head is turned by dragging,
 * as far as the plate goes and no further.
 *
 * Pure, in plate pixels, so the claim "Ghostbusters is reachable on a phone"
 * can be checked without a browser. `drift` is the stage's horizontal offset:
 * positive moves the room right, which shows more of its left.
 */
import { PLATE, caseBox, cubbyAt } from "./shelfGeometry";

export const OVERSCAN = 1.06;
/** How far the pointer may aim the head when the wall already fits. */
export const DRIFT_LIMIT = 14;
/** The shelving, fin to fin, measured off the plate. */
export const WALL = { left: 53, right: 527 } as const;
/** Between the cabinets, fins 253 ‖ 256: the pair October cares about. */
export const FIRST_LOOK = 256;

export interface Framing {
  readonly scale: number;
  /** Plate pixels across the screen. */
  readonly visible: number;
  /** The wall is wider than the screen: drag to look along it. */
  readonly pan: boolean;
  /** How far the head may turn either way, in plate pixels. */
  readonly reach: number;
  /** Where the head starts. */
  readonly first: number;
}

export function framing(width: number, height: number): Framing {
  const scale = Math.max(width / PLATE.width, height / PLATE.height) * OVERSCAN;
  const visible = width / scale;
  const slack = (PLATE.width - visible) / 2;
  const pan = visible < WALL.right - WALL.left;
  const reach = pan
    ? Math.max(0, slack)
    : Math.max(0, Math.min(slack * 0.75, DRIFT_LIMIT));
  return {
    scale,
    visible,
    pan,
    reach,
    first: pan ? facing(FIRST_LOOK, reach) : 0,
  };
}

/** The drift that centres plate x, within what the plate can show. */
export function facing(x: number, reach: number): number {
  return Math.max(-reach, Math.min(reach, PLATE.width / 2 - x));
}

/** The plate x range on screen at a given drift. */
export function inView(f: Framing, drift: number): [number, number] {
  const centre = PLATE.width / 2 - drift;
  return [centre - f.visible / 2, centre + f.visible / 2];
}

/** Whether a tape's case is wholly on screen at a given drift. */
export function caseInView(
  f: Framing,
  drift: number,
  at: { row: number; col: number; nudge?: number },
): boolean {
  const box = caseBox(cubbyAt(at.row, at.col), at.nudge ?? 0);
  const [l, r] = inView(f, drift);
  return box.left >= l && box.left + box.width <= r;
}
