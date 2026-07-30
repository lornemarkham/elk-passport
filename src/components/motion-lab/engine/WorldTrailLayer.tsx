"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ParticleMaterial } from "./types";
import { generateParticleMotion, particleStyle } from "./particlePhysics";
import styles from "./LivingCard.module.css";

export interface TrailDeposit {
  id: number;
  /** Stage-relative pixels — where the object was at the instant this was left behind. */
  xPx: number;
  yPx: number;
}

/**
 * Manages the list of "left behind" particles for one experience. Deposits
 * are added on demand (see `usePhysicsBody`'s detachment logic) and remove
 * themselves once their own one-shot animation finishes — nothing here
 * grows unbounded across a long drag session.
 */
export function useWorldTrail() {
  const [deposits, setDeposits] = useState<TrailDeposit[]>([]);
  const nextId = useRef(0);

  const deposit = useCallback((xPx: number, yPx: number) => {
    const id = nextId.current;
    nextId.current += 1;
    setDeposits((prev) => [...prev, { id, xPx, yPx }]);
  }, []);

  const expire = useCallback((id: number) => {
    setDeposits((prev) => prev.filter((d) => d.id !== id));
  }, []);

  return { deposits, deposit, expire };
}

function TrailParticle({
  deposit,
  material,
  speed,
  jitter,
  onExpire,
}: {
  deposit: TrailDeposit;
  material: ParticleMaterial;
  speed: number;
  jitter: number;
  onExpire: (id: number) => void;
}) {
  // Generated exactly once, for this particle's entire one-shot life — never
  // regenerated even if a debug slider changes speed/jitter mid-flight,
  // which would otherwise make an already-animating particle jump. A lazy
  // useState initializer (not useRef) because the value is read during render.
  const [motion] = useState(() =>
    generateParticleMotion(material, speed, jitter),
  );
  const lifetimeMs =
    parseFloat(motion.duration) * 1000 + parseFloat(motion.delay) * 1000 + 200;

  useEffect(() => {
    const timeout = window.setTimeout(() => onExpire(deposit.id), lifetimeMs);
    return () => window.clearTimeout(timeout);
  }, [deposit.id, lifetimeMs, onExpire]);

  return (
    <span
      className={`${styles.worldParticle} ${styles[material.direction]}`}
      style={particleStyle(
        motion,
        material,
        `${deposit.xPx}px`,
        `${deposit.yPx}px`,
      )}
    />
  );
}

/**
 * Portals its particles into `container` (the stage) rather than rendering
 * them as children of the draggable card — that's what lets a deposited
 * ember keep existing in real page-space after the card has moved on,
 * instead of being clipped by or transformed along with it.
 */
export function WorldTrailLayer({
  container,
  deposits,
  material,
  speed,
  jitter,
  onExpire,
}: {
  container: HTMLElement | null;
  deposits: TrailDeposit[];
  material: ParticleMaterial;
  speed: number;
  jitter: number;
  onExpire: (id: number) => void;
}) {
  if (!container) return null;

  return createPortal(
    <div className={styles.worldTrailLayer}>
      {deposits.map((d) => (
        <TrailParticle
          key={d.id}
          deposit={d}
          material={material}
          speed={speed}
          jitter={jitter}
          onExpire={onExpire}
        />
      ))}
    </div>,
    container,
  );
}
