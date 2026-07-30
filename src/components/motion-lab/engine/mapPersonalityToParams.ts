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
