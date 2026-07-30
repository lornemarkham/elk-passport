"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { ParticleMaterial } from "./types";
import styles from "./LivingCard.module.css";

interface Particle {
  id: number;
  startX: string;
  startY: string;
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
 * One particle generator, four completely different behaviors depending on
 * `material.direction` — the same shed-embers system becomes downwash dust,
 * diffusing steam, or falling dirt just by changing which way things travel
 * and how far they spread. `jitter` (chaos) widens every random range;
 * `speed` (energy) shortens durations and lengthens travel.
 */
function generateParticles(
  count: number,
  material: ParticleMaterial,
  speed: number,
  jitter: number,
): Particle[] {
  const spreadRange = 24 + material.spread * 60;
  const baseTravel = 70 + speed * 40;
  const jitterFactor = 0.4 + jitter * 0.9;

  return Array.from({ length: count }, (_, id) => {
    const startX = `${40 + randomBetween(-1, 1) * 24 * (0.5 + material.spread)}%`;
    const angle = randomBetween(0, Math.PI * 2);

    let driftX = 0;
    let driftY = 0;
    let startY = "26%";

    switch (material.direction) {
      case "rise":
        driftX = randomBetween(-spreadRange, spreadRange) * 0.4;
        driftY = -(baseTravel + randomBetween(0, baseTravel * jitterFactor));
        break;
      case "fall":
        driftX = randomBetween(-spreadRange, spreadRange) * 0.6;
        driftY =
          baseTravel * 0.6 + randomBetween(0, baseTravel * jitterFactor * 0.7);
        startY = "45%";
        break;
      case "outward":
        driftX =
          Math.cos(angle) *
          (baseTravel + randomBetween(0, baseTravel * jitterFactor));
        driftY =
          Math.abs(Math.sin(angle)) * baseTravel * 0.5 + baseTravel * 0.2;
        startY = "50%";
        break;
      case "static":
        driftX = 0;
        driftY = 0;
        break;
    }

    return {
      id,
      startX,
      startY,
      driftX: `${driftX}px`,
      driftY: `${driftY}px`,
      size: `${(2 + randomBetween(0, 2.5 * jitterFactor)).toFixed(1)}px`,
      duration: `${(2.6 + randomBetween(0, 4 * (1.4 - speed * 0.25))).toFixed(2)}s`,
      delay: `${randomBetween(0, 5).toFixed(2)}s`,
      peakOpacity: 0.55 + randomBetween(0, 0.4),
    };
  });
}

function particleStyle(p: Particle, material: ParticleMaterial): CSSProperties {
  return {
    "--start-x": p.startX,
    "--start-y": p.startY,
    "--drift-x": p.driftX,
    "--drift-y": p.driftY,
    "--size": p.size,
    "--duration": p.duration,
    "--delay": p.delay,
    "--peak-opacity": p.peakOpacity,
    background: `radial-gradient(circle, rgba(${material.color}, 0.95) 0%, rgba(${material.colorSoft}, 0.6) 55%, rgba(${material.colorSoft}, 0) 100%)`,
  } as CSSProperties;
}

/** One independent burst source (surprise, toss, or flourish), re-keyed by its own trigger count. Memoized so it doesn't reroll on every unrelated re-render. */
function Burst({
  trigger,
  material,
  speed,
  jitter,
}: {
  trigger: number;
  material: ParticleMaterial;
  speed: number;
  jitter: number;
}) {
  const particles = useMemo(
    () =>
      trigger > 0
        ? generateParticles(3, material, speed * 1.4, Math.min(1, jitter + 0.3))
        : [],
    [trigger, material, speed, jitter],
  );

  return (
    <>
      {particles.map((p) => (
        <span
          key={`${trigger}-${p.id}`}
          className={`${styles.particle} ${styles.burst} ${styles[material.direction]}`}
          style={particleStyle(p, material)}
        />
      ))}
    </>
  );
}

export function ParticleField({
  material,
  count,
  speed,
  jitter,
  surpriseTrigger,
  tossTrigger,
  flourishTrigger,
  reducedMotion,
}: {
  material: ParticleMaterial;
  count: number;
  speed: number;
  jitter: number;
  /** Three independent moments worth a brighter, larger one-shot burst. */
  surpriseTrigger: number;
  tossTrigger: number;
  flourishTrigger: number;
  reducedMotion: boolean;
}) {
  const [ambient, setAmbient] = useState<Particle[]>([]);

  // Randomized, so generation must happen client-side, after mount — doing
  // it during render would run during SSR too and mismatch the client.
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setAmbient(
        reducedMotion ? [] : generateParticles(count, material, speed, jitter),
      );
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [reducedMotion, count, material, speed, jitter]);

  if (reducedMotion) return null;

  return (
    <div className={styles.particleLayer}>
      {ambient.map((p) => (
        <span
          key={p.id}
          className={`${styles.particle} ${styles[material.direction]}`}
          style={particleStyle(p, material)}
        />
      ))}
      <Burst
        trigger={surpriseTrigger}
        material={material}
        speed={speed}
        jitter={jitter}
      />
      <Burst
        trigger={tossTrigger}
        material={material}
        speed={speed}
        jitter={jitter}
      />
      <Burst
        trigger={flourishTrigger}
        material={material}
        speed={speed}
        jitter={jitter}
      />
    </div>
  );
}
