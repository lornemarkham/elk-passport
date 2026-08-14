"use client";

import { useState } from "react";
import { motion, useMotionValue, type MotionValue } from "framer-motion";
import { NoiseField, nextNoiseSeed } from "../primitives/noise";
import { useSharedRaf } from "../primitives/useSharedRaf";

export interface GlowProps {
  /** "r, g, b" — matches the `rgba(${hue}, alpha)` convention already used
   * throughout both existing card systems. */
  hue: string;
  hueSoft: string;
  attention?: MotionValue<number>;
  baseOpacity?: number;
  peakOpacity?: number;
  /** Roughly how many breathing cycles per 10 seconds — small and
   * irregular by default; this is meant to be felt, not watched. */
  breatheSpeed?: number;
  reducedMotion: boolean;
  className?: string;
}

/**
 * A breathing aura, continuously sampled from noise rather than authored
 * as a CSS `@keyframes` opacity/scale sequence — this is what replaces
 * both Motion Lab's `breatheScale` array and Discovery Card's
 * `LIFE_PRESETS` timeline. Same visual idea (a soft light source that
 * rises and falls), driven by a continuous field instead of hand-picked
 * keyframe stops, so it never reads as a loop with a fixed period.
 */
export function Glow({
  hue,
  hueSoft,
  attention,
  baseOpacity = 0.35,
  peakOpacity = 0.75,
  breatheSpeed = 0.12,
  reducedMotion,
  className,
}: GlowProps) {
  const [noise] = useState(() => new NoiseField(nextNoiseSeed()));
  const opacity = useMotionValue((baseOpacity + peakOpacity) / 2);
  const scale = useMotionValue(1);

  useSharedRaf((_deltaSeconds, elapsedSeconds) => {
    const currentAttention = attention?.get() ?? 0;
    const n = noise.get01(0, 0, elapsedSeconds * breatheSpeed);
    opacity.set(
      baseOpacity + n * (peakOpacity - baseOpacity) + currentAttention * 0.2,
    );
    scale.set(1 + n * 0.08 + currentAttention * 0.12);
  }, !reducedMotion);

  return (
    <motion.div
      aria-hidden
      className={className}
      style={{
        position: "absolute",
        inset: "-40%",
        borderRadius: "50%",
        pointerEvents: "none",
        filter: "blur(28px)",
        opacity: reducedMotion ? (baseOpacity + peakOpacity) / 2 : opacity,
        scale: reducedMotion ? 1 : scale,
        background: `radial-gradient(circle, rgba(${hue}, 0.9) 0%, rgba(${hueSoft}, 0.4) 45%, rgba(${hueSoft}, 0) 75%)`,
      }}
    />
  );
}
