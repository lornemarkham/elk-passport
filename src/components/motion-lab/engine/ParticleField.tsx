"use client";

import { useEffect, useMemo, useState } from "react";
import type { ParticleMaterial } from "./types";
import { generateParticleMotion, particleStyle } from "./particlePhysics";
import styles from "./LivingCard.module.css";

interface AmbientParticle {
  id: number;
  startX: string;
}

/** Ambient particles, anchored to the card, positioned in percent of it — unchanged from Sprint 003. */
function generateAmbient(
  count: number,
  material: ParticleMaterial,
): AmbientParticle[] {
  return Array.from({ length: count }, (_, id) => ({
    id,
    startX: `${40 + (Math.random() - 0.5) * 2 * 24 * (0.5 + material.spread)}%`,
  }));
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
        ? generateAmbient(3, material).map((p) => ({
            ...p,
            motion: generateParticleMotion(
              material,
              speed * 1.4,
              Math.min(1, jitter + 0.3),
            ),
          }))
        : [],
    [trigger, material, speed, jitter],
  );

  return (
    <>
      {particles.map((p) => (
        <span
          key={`${trigger}-${p.id}`}
          className={`${styles.particle} ${styles.burst} ${styles[material.direction]}`}
          style={particleStyle(p.motion, material, p.startX, "26%")}
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
  const [ambient, setAmbient] = useState<
    (AmbientParticle & { motion: ReturnType<typeof generateParticleMotion> })[]
  >([]);

  // Randomized, so generation must happen client-side, after mount — doing
  // it during render would run during SSR too and mismatch the client.
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setAmbient(
        reducedMotion
          ? []
          : generateAmbient(count, material).map((p) => ({
              ...p,
              motion: generateParticleMotion(material, speed, jitter),
            })),
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
          style={particleStyle(p.motion, material, p.startX, "26%")}
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
