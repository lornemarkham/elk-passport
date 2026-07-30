"use client";

import { useEffect, useState, type CSSProperties } from "react";
import styles from "./LivingExperience.module.css";

interface AmbientEmber {
  id: number;
  startX: string;
  driftX: string;
  rise: string;
  size: string;
  duration: string;
  delay: string;
}

/** CSS-driven, not framer-motion — cheaper for a handful of small looping particles, and randomized once so no two look identical. */
function generateAmbientEmbers(count: number): AmbientEmber[] {
  return Array.from({ length: count }, (_, id) => ({
    id,
    startX: `${30 + Math.random() * 40}%`,
    driftX: `${(Math.random() - 0.5) * 28}px`,
    rise: `${-(60 + Math.random() * 50)}px`,
    size: `${2 + Math.random() * 2}px`,
    duration: `${3.5 + Math.random() * 3}s`,
    delay: `${Math.random() * 6}s`,
  }));
}

function bigEmberStyle(): CSSProperties {
  return {
    "--start-x": `${40 + Math.random() * 20}%`,
    "--drift-x": `${(Math.random() - 0.5) * 20}px`,
  } as CSSProperties;
}

/**
 * Ambient drift, always running, plus two occasional brighter sparks — one
 * for an unprompted surprise beat, one for a real drag toss. Each spark is a
 * single element re-keyed by its trigger count, so a new one replays the
 * same one-shot CSS animation from scratch (mirrors Flame's flarePulse) —
 * no list of transient elements to track or clean up.
 */
export function EmberField({
  surpriseTrigger,
  tossTrigger,
  reducedMotion,
}: {
  surpriseTrigger: number;
  tossTrigger: number;
  reducedMotion: boolean;
}) {
  // Randomized, so it must be generated client-side only, after mount — doing
  // it during render (even via useMemo) would run on the server too and
  // produce different values than the client's first render, a hydration
  // mismatch. Empty on first paint is fine: the embers simply begin a
  // moment after the page appears, which reads as natural rather than late.
  const [ambient, setAmbient] = useState<AmbientEmber[]>([]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setAmbient(reducedMotion ? [] : generateAmbientEmbers(6));
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [reducedMotion]);

  if (reducedMotion) return null;

  return (
    <div className={styles.emberLayer}>
      {ambient.map((ember) => (
        <span
          key={ember.id}
          className={styles.ember}
          style={
            {
              "--start-x": ember.startX,
              "--drift-x": ember.driftX,
              "--rise": ember.rise,
              "--size": ember.size,
              "--duration": ember.duration,
              "--delay": ember.delay,
            } as CSSProperties
          }
        />
      ))}
      {surpriseTrigger > 0 && (
        <span
          key={`surprise-${surpriseTrigger}`}
          className={styles.bigEmber}
          style={bigEmberStyle()}
        />
      )}
      {tossTrigger > 0 && (
        <span
          key={`toss-${tossTrigger}`}
          className={styles.bigEmber}
          style={bigEmberStyle()}
        />
      )}
    </div>
  );
}
