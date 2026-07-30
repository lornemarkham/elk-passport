"use client";

import {
  motion,
  useMotionValue,
  useMotionTemplate,
  useSpring,
  useTransform,
} from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { Experience } from "./experience";
import styles from "./LivingExperience.module.css";

/** How far out (in px, beyond the card's own edge) the cursor's approach starts registering at all. */
const AWARENESS_RADIUS_PX = 260;

/** Proximity above this is treated as "the card has noticed" for breathing-tier purposes only — everything continuous (glow/lift/shadow) responds below this too, just faintly. */
const NEAR_THRESHOLD = 0.06;

/** How long a just-departed hover stays warm before actually letting go — the "Linger" phase, held distinct from the spring-driven "soft exhale" that follows it. */
const LINGER_MS = 650;

const BREATHE_BY_TIER = {
  idle: { duration: 6, scale: 1.012 },
  aware: { duration: 5, scale: 1.018 },
  focus: { duration: 3.6, scale: 1.025 },
} as const;

export function LivingExperience({ experience }: { experience: Experience }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const rectRef = useRef<DOMRect | null>(null);
  const isNearRef = useRef(false);
  const lingerTimeoutRef = useRef<number | null>(null);

  const [isNear, setIsNear] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  // Proximity: how close the cursor is, continuously — this is what lets the
  // card "quietly notice" someone before they ever touch it.
  const proximity = useMotionValue(0);
  const proximitySpring = useSpring(proximity, {
    stiffness: 90,
    damping: 18,
    mass: 0.6,
  });

  // Focus: 0 or 1, but reached through a soft spring rather than a snap — the
  // decay after mouseleave (once the Linger hold below releases it) *is* the
  // "soft exhale," no separate fade-out animation needed.
  const focus = useMotionValue(0);
  const focusSpring = useSpring(focus, {
    stiffness: 55,
    damping: 16,
    mass: 0.9,
  });

  const combined = useTransform<number, number>(
    [proximitySpring, focusSpring],
    ([p, f]) => Math.max(p, f),
  );

  const liftY = useTransform(combined, [0, 1], [0, -14]);
  const liftScale = useTransform(combined, [0, 1], [1, 1.012]);
  const glowOpacity = useTransform(combined, [0, 1], [0.55, 1]);
  const brightness = useTransform(combined, [0, 1], [1, 1.06]);
  const shadowY = useTransform(combined, [0, 1], [24, 46]);
  const shadowBlur = useTransform(combined, [0, 1], [50, 100]);
  const shadowAlpha = useTransform(combined, [0, 1], [0.28, 0.6]);
  const filter = useMotionTemplate`brightness(${brightness})`;
  const boxShadow = useMotionTemplate`0 ${shadowY}px ${shadowBlur}px -10px rgba(255, 140, 70, ${shadowAlpha})`;

  // Future memory brightens specifically on real focus, not mere approach —
  // proximity alone should feel noticed, not already-arrived.
  const futureMemoryOpacity = useTransform(focusSpring, [0, 1], [0.45, 1]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleReducedMotionChange = (event: MediaQueryListEvent) =>
      setPrefersReducedMotion(event.matches);
    query.addEventListener("change", handleReducedMotionChange);
    return () => query.removeEventListener("change", handleReducedMotionChange);
  }, []);

  // A pending Linger timeout must not fire after the component is gone.
  useEffect(() => {
    return () => {
      if (lingerTimeoutRef.current !== null) {
        window.clearTimeout(lingerTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const measure = () => {
      rectRef.current = cardRef.current?.getBoundingClientRect() ?? null;
    };
    measure();
    window.addEventListener("resize", measure);

    if (prefersReducedMotion) {
      return () => window.removeEventListener("resize", measure);
    }

    const handleMouseMove = (event: MouseEvent) => {
      const rect = rectRef.current;
      if (!rect) return;

      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const distance = Math.hypot(
        event.clientX - centerX,
        event.clientY - centerY,
      );
      const halfDiagonal = Math.hypot(rect.width / 2, rect.height / 2);
      const edgeDistance = Math.max(0, distance - halfDiagonal);
      const normalized = 1 - Math.min(1, edgeDistance / AWARENESS_RADIUS_PX);

      proximity.set(normalized);

      const near = normalized > NEAR_THRESHOLD;
      if (near !== isNearRef.current) {
        isNearRef.current = near;
        setIsNear(near);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [proximity, prefersReducedMotion]);

  const handlePointerEnter = () => {
    if (lingerTimeoutRef.current !== null) {
      window.clearTimeout(lingerTimeoutRef.current);
      lingerTimeoutRef.current = null;
    }
    focus.set(1);
    setIsFocused(true);
  };

  const handlePointerLeave = () => {
    // Stay warm for a beat (Linger) before the spring is allowed to release
    // (Soft exhale) — otherwise the two read as one instant fade.
    lingerTimeoutRef.current = window.setTimeout(() => {
      focus.set(0);
      setIsFocused(false);
      lingerTimeoutRef.current = null;
    }, LINGER_MS);
  };

  const tier: keyof typeof BREATHE_BY_TIER = isFocused
    ? "focus"
    : isNear
      ? "aware"
      : "idle";
  const breathe = BREATHE_BY_TIER[tier];
  const reducedMotion = prefersReducedMotion;

  return (
    <motion.div
      ref={cardRef}
      className={styles.card}
      onMouseEnter={handlePointerEnter}
      onMouseLeave={handlePointerLeave}
      style={
        reducedMotion
          ? undefined
          : { y: liftY, scale: liftScale, boxShadow, filter }
      }
      aria-label={experience.title}
    >
      <motion.div
        className={styles.glow}
        style={reducedMotion ? undefined : { opacity: glowOpacity }}
      />

      <motion.div
        className={styles.core}
        animate={reducedMotion ? undefined : { scale: [1, breathe.scale, 1] }}
        transition={
          reducedMotion
            ? undefined
            : {
                duration: breathe.duration,
                repeat: Infinity,
                ease: "easeInOut",
              }
        }
      >
        <h2 className={styles.title}>{experience.title}</h2>
        <motion.p
          className={styles.futureMemory}
          style={reducedMotion ? undefined : { opacity: futureMemoryOpacity }}
        >
          {experience.futureMemory}
        </motion.p>
      </motion.div>
    </motion.div>
  );
}
