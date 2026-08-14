import type { NoiseField } from "./noise";

/**
 * The shared engine behind every drifting-particle phenomenon (embers,
 * smoke, dust, leaves, snow, pollen, insects). Each particle's heading is
 * read from a noise field that varies slowly over space and time, instead
 * of being re-rolled with `Math.random()` every frame — that's what turns
 * "random jitter" into "wind." Neighboring particles sampled close together
 * in space and time drift coherently, the way real airborne things do.
 */
export function sampleFlowAngle(
  noise: NoiseField,
  x: number,
  y: number,
  elapsedSeconds: number,
  scale = 0.01,
  timeScale = 0.15,
): number {
  return (
    noise.get3D(x * scale, y * scale, elapsedSeconds * timeScale) * Math.PI * 2
  );
}

export interface FlowParticleState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  lifetime: number;
}

/**
 * Advances one particle by one tick: blends its current heading toward the
 * flow field's suggestion (so it turns rather than snaps), applies a
 * constant drift (buoyancy/gravity — negative for "rises," positive for
 * "falls"), and integrates position. Pure and framework-free so it can be
 * unit-tested without mounting anything.
 */
export function advectParticle(
  particle: FlowParticleState,
  noise: NoiseField,
  deltaSeconds: number,
  elapsedSeconds: number,
  options: {
    speed: number;
    turnRate: number;
    buoyancy: number;
    flowScale?: number;
    flowTimeScale?: number;
    /** Shared-wind bias, additive on top of the particle's own local flow
     * sample — angle in radians, strength in the same units as `speed`.
     * Optional and defaulted to "no wind" so every existing solo-card call
     * site (no `FieldEnvironment` in scope) is unaffected; this is how a
     * field-level broadcast reaches a primitive that was built before the
     * field existed, without forking a second "windy" variant of it. */
    windAngle?: number;
    windStrength?: number;
  },
): FlowParticleState {
  const angle = sampleFlowAngle(
    noise,
    particle.x,
    particle.y,
    elapsedSeconds,
    options.flowScale,
    options.flowTimeScale,
  );
  const windAngle = options.windAngle ?? 0;
  const windStrength = options.windStrength ?? 0;
  const targetVx =
    Math.cos(angle) * options.speed + Math.cos(windAngle) * windStrength;
  const targetVy =
    Math.sin(angle) * options.speed +
    options.buoyancy +
    Math.sin(windAngle) * windStrength;

  const turn = Math.min(1, options.turnRate * deltaSeconds);
  const vx = particle.vx + (targetVx - particle.vx) * turn;
  const vy = particle.vy + (targetVy - particle.vy) * turn;

  return {
    x: particle.x + vx * deltaSeconds,
    y: particle.y + vy * deltaSeconds,
    vx,
    vy,
    age: particle.age + deltaSeconds,
    lifetime: particle.lifetime,
  };
}
