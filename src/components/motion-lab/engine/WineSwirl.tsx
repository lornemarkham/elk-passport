"use client";

import { motion } from "framer-motion";
import styles from "./LivingCard.module.css";

/** A slow rotating highlight within the glow — light catching liquid as it settles. */
export function WineSwirl({ durationS }: { durationS: number }) {
  return (
    <motion.div
      className={styles.wineSwirl}
      animate={{ rotate: 360 }}
      transition={{ duration: durationS, repeat: Infinity, ease: "linear" }}
    />
  );
}
