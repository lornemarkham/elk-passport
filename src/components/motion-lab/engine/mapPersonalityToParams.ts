import type { Personality, PhysicsCharacter } from "./types";

/**
 * The actual engine: nine trait values become the concrete numbers every
 * animation system reads. Nothing downstream of this function knows what
 * "curiosity" or "gravity" mean — it only sees radii, stiffnesses, and
 * durations. This is deliberately pure and framework-free so the mapping
 * itself can be read, reasoned about, and tuned in one place.
 */
export interface MotionParams {
  // Attention — how far it senses the cursor, and how eagerly.
  awarenessRadiusPx: number;
  noticeDelayMs: number;
  followStiffness: number;

  // Curiosity — how much it turns to track the cursor, not just glow at it.
  leanDistancePx: number;
  leanStiffness: number;
  leanDamping: number;

  // Energy — amplitude, brightness, and how busy the particles get.
  breathAmplitude: number;
  brightnessCeiling: number;
  particleCount: number;
  particleSpeed: number;

  // Chaos — 0–1, randomness injected into timing and position everywhere else.
  jitter: number;

  // Gravity — drag physics, shaped further by PhysicsCharacter.
  dragMass: number;
  dragStiffness: number;
  dragDamping: number;
  dragElastic: number;

  // Body deformation under drag — how the card itself moves, not just where.
  // Shaped primarily by PhysicsCharacter (what kind of thing this is), scaled
  // by Energy/Chaos (how much, this time).
  tiltMaxDeg: number;
  tiltLagStiffness: number;
  tiltLagDamping: number;
  skewSensitivity: number;
  squashAmount: number;

  // World-space trail — when material detaches from the object and is left
  // behind in the environment, driven by Energy (how easily) and Chaos (how
  // widely it scatters).
  detachThresholdPxPerS: number;
  trailEmissionRate: number;
  trailWorldSpreadPx: number;

  // Playfulness — reward for interacting with it at all.
  flourishChance: number;
  flourishScale: number;

  // Rhythm — idle cadence.
  breathDurationS: number;

  // Mystery — how often something happens unprompted.
  surpriseMinMs: number;
  surpriseMaxMs: number;

  // Warmth — glow presence and how gently things settle.
  glowRadiusPct: number;
  glowBlurPx: number;
  glowOpacityCeiling: number;
  settleSoftness: number;
}

const lerp = (min: number, max: number, t: number) => min + (max - min) * t;
const t = (value: number) => Math.min(1, Math.max(0, value / 100));

export function mapPersonalityToParams(
  p: Personality,
  physics: PhysicsCharacter,
): MotionParams {
  // Physics character changes what "heavy" *means*, not just how heavy.
  const [stiffnessMax, stiffnessMin] =
    physics === "liquid"
      ? [110, 55]
      : physics === "floaty"
        ? [70, 45]
        : physics === "agile"
          ? [260, 150]
          : [320, 130];
  const [dampingMax, dampingMin] =
    physics === "liquid"
      ? [16, 6]
      : physics === "floaty"
        ? [18, 10]
        : physics === "agile"
          ? [22, 14]
          : [26, 12];

  // What kind of body this is, before personality scales "how much." A rigid
  // machine barely tilts and never lags; a liquid tilts modestly but keeps
  // rotating long after the card stops; an agile thing tilts hard and tracks
  // velocity almost instantly.
  const [
    tiltMaxBase,
    tiltLagStiffnessBase,
    tiltLagDampingBase,
    skewBase,
    squashBase,
  ] =
    physics === "rigid"
      ? [7, 220, 30, 0.03, 0.012]
      : physics === "liquid"
        ? [11, 45, 5, 0.06, 0.015]
        : physics === "agile"
          ? [28, 260, 16, 0.22, 0.05]
          : [16, 70, 12, 0.14, 0.03]; // floaty

  return {
    awarenessRadiusPx: lerp(90, 460, t(p.attention)),
    noticeDelayMs: lerp(900, 30, t(p.attention)),
    followStiffness: lerp(35, 170, t(p.attention)),

    leanDistancePx: lerp(0, 64, t(p.curiosity)),
    leanStiffness: lerp(25, 150, t(p.curiosity)),
    leanDamping: lerp(20, 9, t(p.curiosity)),

    breathAmplitude: lerp(0.004, 0.1, t(p.energy)),
    brightnessCeiling: lerp(1.02, 1.45, t(p.energy)),
    particleCount: Math.round(lerp(1, 16, t(p.energy))),
    particleSpeed: lerp(0.55, 2.4, t(p.energy)),

    jitter: t(p.chaos),

    dragMass: lerp(0.25, 2.6, t(p.gravity)),
    dragStiffness: lerp(stiffnessMax, stiffnessMin, t(p.gravity)),
    dragDamping: lerp(dampingMax, dampingMin, t(p.gravity)),
    dragElastic:
      0.36 - Math.min(0.3, (lerp(0.25, 2.6, t(p.gravity)) / 2.6) * 0.3),

    tiltMaxDeg: tiltMaxBase * lerp(0.55, 1, t(p.energy)),
    tiltLagStiffness: tiltLagStiffnessBase,
    tiltLagDamping: tiltLagDampingBase,
    skewSensitivity: skewBase * lerp(0.4, 1, t(p.chaos)),
    squashAmount: squashBase * lerp(0.5, 1, t(p.energy)),

    detachThresholdPxPerS: lerp(900, 220, t(p.energy)),
    trailEmissionRate: lerp(0.5, 4, t(p.energy)) * lerp(0.6, 1.3, t(p.chaos)),
    trailWorldSpreadPx: lerp(20, 90, t(p.chaos)),

    flourishChance: t(p.playfulness),
    flourishScale: lerp(0.4, 2.2, t(p.playfulness)),

    breathDurationS: lerp(11, 0.9, t(p.rhythm)),

    surpriseMinMs: lerp(75000, 3000, t(p.mystery)),
    surpriseMaxMs: lerp(150000, 7500, t(p.mystery)),

    glowRadiusPct: lerp(48, 105, t(p.warmth)),
    glowBlurPx: lerp(10, 42, t(p.warmth)),
    glowOpacityCeiling: lerp(0.42, 1, t(p.warmth)),
    settleSoftness: t(p.warmth),
  };
}
