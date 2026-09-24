import { HELD, liftTo, type Box } from "./shelfGeometry";

/**
 * **October refusing you a tape, choreographed.**
 *
 * An earlier version of this solved two opposing forces and integrated them
 * forward. It was honest physics and it read as mush, because a contest of
 * springs near the end of a journey moves a case by a pixel and a half. What
 * actually communicates is much cruder and much louder:
 *
 * ```
 * PULL  →  ...no  →  PULLLLLLLL  →  SNAP
 * ```
 *
 * Six beats, each one long enough to be understood and short enough not to be
 * watched. The whole effect is the ratio between the fourth and the fifth: a
 * second and a half of slowly winning, then ninety milliseconds of losing
 * everything. Nothing here is a force model, and it should not become one
 * again.
 *
 * The tape's position is a single scalar `s` along the one straight line every
 * tape travels from its cavity to your hand — so the motion is continuous by
 * construction, and none of these beats can teleport.
 */

export type Beat =
  /** Off the shelf, like anything else. Not far. */
  | "pull"
  /** Something caught it. */
  | "pause"
  /** October takes ground back. */
  | "hauled"
  /** You get it back, slowly, and you start to believe it. */
  | "straining"
  /** You do not get it back. */
  | "snap"
  /** Plastic into wood. */
  | "impact"
  /** Nothing. */
  | "still";

const STEP = 0.008;

/**
 * Milliseconds, and the fraction of the journey each beat ends at. These
 * numbers *are* the interaction — there is no model underneath them to tune.
 */
const SCORE = [
  { beat: "pull", ms: 380, to: 0.26, twist: 0.6 },
  { beat: "pause", ms: 260, to: 0.26, twist: 1.8 },
  { beat: "hauled", ms: 220, to: 0.1, twist: 3.4 },
  { beat: "straining", ms: 1400, to: 0.44, twist: 5.2 },
  { beat: "snap", ms: 90, to: 0, twist: 9 },
] as const satisfies readonly {
  beat: Beat;
  ms: number;
  to: number;
  twist: number;
}[];

/** After it lands: the cavity giving, once, and the strain unwinding. */
const SETTLE_MS = 230;
const STILL_MS = 210;
/** How hard it arrives. Drives the shelf, the room and the thud. */
const IMPACT_FORCE = 1;

export interface Moment {
  readonly t: number;
  readonly beat: Beat;
  /** 0 seated, 1 held. */
  readonly s: number;
  /** Plate pixels sideways — the case pulled out of true under load. */
  readonly strain: number;
  /** Degrees. */
  readonly twist: number;
  /** Extra plate pixels into the cavity as it lands, decaying. */
  readonly bite: number;
}

export interface Rejection {
  readonly moments: readonly Moment[];
  readonly impactAt: number;
  readonly impactForce: number;
  readonly duration: number;
  /** When each beat starts, in seconds. For scheduling everything else. */
  readonly cues: Readonly<Record<Beat, number>>;
}

const easeOut = (p: number) => 1 - (1 - p) ** 2.4;
const easeInOut = (p: number) =>
  p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2;
/** Creeping: fast enough to be progress, slow enough to be a struggle. */
const creep = (p: number) => p ** 0.82;
/** No easing at all on the way home. It is not a return, it is a seizure. */
const rip = (p: number) => p ** 1.6;

export function simulateRejection(): Rejection {
  const moments: Moment[] = [];
  const cues = {} as Record<Beat, number>;
  let t = 0;
  let from = 0;
  let twistFrom = 0;

  for (const step of SCORE) {
    cues[step.beat] = t;
    const span = step.ms / 1000;
    const shape =
      step.beat === "snap"
        ? rip
        : step.beat === "straining"
          ? creep
          : step.beat === "hauled"
            ? easeInOut
            : easeOut;
    for (let u = 0; u < span; u += STEP) {
      const p = Math.min(1, u / span);
      moments.push({
        t: t + u,
        beat: step.beat,
        s: from + (step.to - from) * shape(p),
        twist: twistFrom + (step.twist - twistFrom) * p,
        strain: (twistFrom + (step.twist - twistFrom) * p) * 0.18,
        bite: 0,
      });
    }
    t += span;
    from = step.to;
    twistFrom = step.twist;
  }

  const impactAt = t;
  cues.impact = t;
  // It goes a little further into the cavity than it should and comes back
  // out to sit. Once — a case slammed into old wood compresses, it does not
  // bounce — and the torque it was carrying unwinds with it.
  for (let u = 0; u < SETTLE_MS / 1000; u += STEP) {
    const p = u / (SETTLE_MS / 1000);
    const give = Math.sin(Math.PI * Math.min(1, p * 1.25)) * (1 - p) ** 0.7;
    moments.push({
      t: t + u,
      beat: "impact",
      s: 0,
      twist: twistFrom * (1 - p) ** 1.5,
      strain: twistFrom * (1 - p) ** 1.5 * 0.16,
      bite: give * 6,
    });
  }
  t += SETTLE_MS / 1000;

  cues.still = t;
  for (let u = 0; u < STILL_MS / 1000; u += STEP) {
    moments.push({
      t: t + u,
      beat: "still",
      s: 0,
      twist: 0,
      strain: 0,
      bite: 0,
    });
  }
  t += STILL_MS / 1000;

  return { moments, impactAt, impactForce: IMPACT_FORCE, duration: t, cues };
}

/**
 * Where a tape is when it is `s` of the way from its cavity to your hand.
 *
 * The same straight line the ordinary pickup travels: the projected height and
 * the projected centre both interpolate, and `liftTo` solves for the depth and
 * the lateral move that put them there. At `s = 0` it resolves to the tape
 * sitting in its cavity.
 */
export function poseAlong(box: Box, seat: number, s: number) {
  const height = box.height + s * (HELD.height - box.height);
  const startX = box.left + box.width / 2;
  const startY = box.top + box.height / 2;
  const lift = liftTo(
    box,
    {
      x: startX + s * (HELD.x - startX),
      y: startY + s * (HELD.y - startY),
    },
    height,
  );
  return { x: lift.x, y: lift.y, z: lift.z + seat * (1 - s) };
}

/** Degrees of Y the case shows as it comes out, matching the normal pickup. */
export function turnAlong(along: number, s: number, out: number, held: number) {
  if (s <= along) return (s / Math.max(along, 1e-6)) * out;
  return out + ((s - along) / (1 - along)) * (held - out);
}
