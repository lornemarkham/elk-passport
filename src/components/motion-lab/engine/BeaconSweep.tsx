"use client";

import { motion } from "framer-motion";
import styles from "./LivingCard.module.css";

/** A rotating searchlight wedge, escaping the card into the dark stage — mechanical, scanning, alert. */
export function BeaconSweep({
  accentColor,
  durationS,
}: {
  accentColor: string;
  durationS: number;
}) {
  return (
    <motion.div
      className={styles.beaconSweep}
      style={{
        background: `conic-gradient(from 0deg, rgba(${accentColor}, 0.4) 0deg, rgba(${accentColor}, 0) 35deg, rgba(${accentColor}, 0) 360deg)`,
      }}
      animate={{ rotate: 360 }}
      transition={{ duration: durationS, repeat: Infinity, ease: "linear" }}
    />
  );
}
