import type { CSSProperties } from "react";
import type { ParticleMaterial } from "./types";

/**
 * Shared particle math — used by both the ambient field (particles anchored
 * to the card, positioned in percent) and the world-space trail layer
 * (particles anchored to an absolute stage position, positioned in pixels).
 * Only the *origin* differs between the two; how a particle drifts once
 * spawned is identical, because it's the same physical material either way.
 */
export interface ParticleMotion {
  driftX: string;
  driftY: string;
  size: string;
  duration: string;
  delay: string;
  peakOpacity: number;
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

/**
 * How a single particle of this material moves once released — rise, fall,
 * blow outward, or flash in place — scaled by speed (Energy) and jitter
 * (Chaos). Independent of where it started.
 */
export function generateParticleMotion(
  material: ParticleMaterial,
  speed: number,
  jitter: number,
): ParticleMotion {
  const spreadRange = 24 + material.spread * 60;
  const baseTravel = 70 + speed * 40;
  const jitterFactor = 0.4 + jitter * 0.9;
  const angle = randomBetween(0, Math.PI * 2);

  let driftX = 0;
  let driftY = 0;

  switch (material.direction) {
    case "rise":
      driftX = randomBetween(-spreadRange, spreadRange) * 0.4;
      driftY = -(baseTravel + randomBetween(0, baseTravel * jitterFactor));
      break;
    case "fall":
      driftX = randomBetween(-spreadRange, spreadRange) * 0.6;
      driftY =
        baseTravel * 0.6 + randomBetween(0, baseTravel * jitterFactor * 0.7);
      break;
    case "outward":
      driftX =
        Math.cos(angle) *
        (baseTravel + randomBetween(0, baseTravel * jitterFactor));
      driftY = Math.abs(Math.sin(angle)) * baseTravel * 0.5 + baseTravel * 0.2;
      break;
    case "static":
      driftX = 0;
      driftY = 0;
      break;
  }

  return {
    driftX: `${driftX}px`,
    driftY: `${driftY}px`,
    size: `${(2 + randomBetween(0, 2.5 * jitterFactor)).toFixed(1)}px`,
    duration: `${(2.6 + randomBetween(0, 4 * (1.4 - speed * 0.25))).toFixed(2)}s`,
    delay: `${randomBetween(0, 5).toFixed(2)}s`,
    peakOpacity: 0.55 + randomBetween(0, 0.4),
  };
}

/** Builds the CSS custom properties a `.particle` element reads — `left`/`top` may be percent (card-anchored) or px (world-anchored); the drift math doesn't care which. */
export function particleStyle(
  motion: ParticleMotion,
  material: ParticleMaterial,
  startX: string,
  startY: string,
): CSSProperties {
  return {
    "--start-x": startX,
    "--start-y": startY,
    "--drift-x": motion.driftX,
    "--drift-y": motion.driftY,
    "--size": motion.size,
    "--duration": motion.duration,
    "--delay": motion.delay,
    "--peak-opacity": motion.peakOpacity,
    background: `radial-gradient(circle, rgba(${material.color}, 0.95) 0%, rgba(${material.colorSoft}, 0.6) 55%, rgba(${material.colorSoft}, 0) 100%)`,
  } as CSSProperties;
}
