"use client";

import { motion } from "framer-motion";
import styles from "./LivingCard.module.css";

/** Slow, soft, overlapping heat-shimmer bands — stillness with a pulse, not fire. */
export function HeatHaze({ durationS }: { durationS: number }) {
  return (
    <div className={styles.hazeLayer}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className={styles.hazeBand}
          style={{ top: `${18 + i * 24}%` }}
          animate={{
            y: [0, -14, 0],
            x: [0, i % 2 === 0 ? 6 : -6, 0],
            opacity: [0.45, 0.75, 0.45],
          }}
          transition={{
            duration: durationS * (1.2 + i * 0.35),
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.7,
          }}
        />
      ))}
    </div>
  );
}
