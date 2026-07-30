"use client";

import { motion, useTransform, type MotionValue } from "framer-motion";
import styles from "./LivingExperience.module.css";

/**
 * Three independent flame-lick layers, each on its own duration and delay,
 * so they drift in and out of phase with each other. A single uniform pulse
 * (Sprint 1's approach) reads as a hover effect; several slightly
 * out-of-sync movements read as fire.
 */
interface FlameLick {
  duration: number;
  delay: number;
  x: number[];
  scaleY: number[];
}

const LICKS: FlameLick[] = [
  { duration: 2.6, delay: 0, x: [-6, 6, -6], scaleY: [1, 1.07, 1] },
  { duration: 3.3, delay: 0.6, x: [4, -5, 4], scaleY: [1, 1.1, 1] },
  { duration: 4.1, delay: 1.3, x: [-3, 3, -3], scaleY: [1, 1.05, 1] },
];

interface FlameProps {
  /** 0–1, how noticed/engaged the fire currently is (proximity or hover, whichever is greater). */
  combined: MotionValue<number>;
  /** True for a brief pulse right after the cursor is first noticed nearby. */
  justNoticed: boolean;
  /** Increments on each unprompted "surprise" beat. */
  surpriseTick: number;
  reducedMotion: boolean;
}

export function Flame({
  combined,
  justNoticed,
  surpriseTick,
  reducedMotion,
}: FlameProps) {
  const glowOpacity = useTransform(combined, [0, 1], [0.6, 1]);
  const glowScale = useTransform(combined, [0, 1], [1, 1.08]);

  return (
    <div className={styles.flameLayer}>
      <motion.div
        className={styles.baseGlow}
        style={
          reducedMotion ? undefined : { opacity: glowOpacity, scale: glowScale }
        }
      />

      {!reducedMotion &&
        LICKS.map((lick, i) => (
          <motion.div
            key={i}
            className={styles.flameBlob}
            animate={{ x: lick.x, scaleY: lick.scaleY, skewX: [-2, 2, -2] }}
            transition={{
              duration: lick.duration,
              delay: lick.delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}

      {!reducedMotion && justNoticed && (
        <motion.div
          className={styles.noticeFlicker}
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: [0, 0.9, 0], scale: [0.92, 1.06, 1] }}
          transition={{ duration: 0.55, ease: "easeOut" }}
        />
      )}

      {!reducedMotion && surpriseTick > 0 && (
        <motion.div
          key={surpriseTick}
          className={styles.flarePulse}
          initial={{ opacity: 0, scale: 1 }}
          animate={{ opacity: [0, 0.7, 0], scale: [1, 1.12, 1] }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
      )}
    </div>
  );
}
