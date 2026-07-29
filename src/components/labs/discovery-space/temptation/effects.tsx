"use client";

import { motion } from "framer-motion";

/**
 * Each renderer owns only its own visual markup for one temptation
 * instance. They know nothing about scheduling, eligibility, or how long
 * they'll be mounted beyond the `durationMs` they're handed — `CardTemptation`
 * mounts them fresh per instance and unmounts them when the scheduler says
 * the event is over.
 */

const EASE = [0.4, 0, 0.2, 1] as const;

interface EffectProps {
  durationMs: number;
}

export function EmberTemptation({ durationMs }: EffectProps) {
  const seconds = durationMs / 1000;
  return (
    <>
      <motion.span
        aria-hidden
        className="absolute h-1 w-1 rounded-full bg-amber-200/70"
        style={{ left: "38%", bottom: "14%" }}
        initial={{ opacity: 0, y: 0, x: 0 }}
        animate={{ opacity: [0, 0.65, 0], y: -46, x: 6 }}
        transition={{ duration: seconds, ease: EASE }}
      />
      <motion.span
        aria-hidden
        className="absolute h-[3px] w-[3px] rounded-full bg-amber-100/60"
        style={{ left: "56%", bottom: "10%" }}
        initial={{ opacity: 0, y: 0, x: 0 }}
        animate={{ opacity: [0, 0.5, 0], y: -34, x: -8 }}
        transition={{
          duration: seconds * 0.85,
          delay: seconds * 0.15,
          ease: EASE,
        }}
      />
    </>
  );
}

export function ShootingStarTemptation({ durationMs }: EffectProps) {
  const seconds = durationMs / 1000;
  return (
    <motion.span
      aria-hidden
      className="absolute h-px w-10 rounded-full bg-linear-to-r from-transparent via-white/70 to-transparent"
      style={{ top: "16%", left: "18%", rotate: "18deg" }}
      initial={{ opacity: 0, x: 0 }}
      animate={{ opacity: [0, 0.8, 0], x: 34 }}
      transition={{ duration: Math.min(seconds, 1.1), ease: EASE }}
    />
  );
}

export function WindowGlowTemptation({ durationMs }: EffectProps) {
  const seconds = durationMs / 1000;
  return (
    <motion.span
      aria-hidden
      className="absolute rounded-[2px] bg-amber-100/50"
      style={{
        top: "30%",
        right: "22%",
        width: 10,
        height: 14,
        boxShadow: "0 0 10px 2px rgba(252, 211, 133, 0.25)",
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 0.55, 0.5, 0] }}
      transition={{
        duration: seconds,
        times: [0, 0.35, 0.7, 1],
        ease: EASE,
      }}
    />
  );
}

export function RippleTemptation({ durationMs }: EffectProps) {
  const seconds = durationMs / 1000;
  return (
    <motion.span
      aria-hidden
      className="absolute rounded-full border border-white/25"
      style={{ left: "42%", bottom: "22%", width: 10, height: 5 }}
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: [0, 0.4, 0], scale: [0.6, 2.4] }}
      transition={{ duration: seconds, ease: EASE }}
    />
  );
}

export function SteamTemptation({ durationMs }: EffectProps) {
  const seconds = durationMs / 1000;
  return (
    <>
      <motion.span
        aria-hidden
        className="absolute w-1 rounded-full bg-white/30 blur-[1px]"
        style={{ left: "46%", bottom: "24%", height: 16 }}
        initial={{ opacity: 0, y: 0, x: 0 }}
        animate={{ opacity: [0, 0.35, 0], y: -28, x: 4 }}
        transition={{ duration: seconds, ease: EASE }}
      />
      <motion.span
        aria-hidden
        className="absolute w-1 rounded-full bg-white/20 blur-[1px]"
        style={{ left: "52%", bottom: "22%", height: 12 }}
        initial={{ opacity: 0, y: 0, x: 0 }}
        animate={{ opacity: [0, 0.28, 0], y: -22, x: -5 }}
        transition={{
          duration: seconds * 0.9,
          delay: seconds * 0.1,
          ease: EASE,
        }}
      />
    </>
  );
}

export function GlintTemptation({ durationMs }: EffectProps) {
  const seconds = durationMs / 1000;
  return (
    <motion.span
      aria-hidden
      className="absolute h-8 w-px bg-linear-to-b from-transparent via-white/60 to-transparent"
      style={{ top: "22%", left: "62%", rotate: "24deg" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 0.7, 0] }}
      transition={{ duration: Math.min(seconds, 0.9), ease: EASE }}
    />
  );
}
