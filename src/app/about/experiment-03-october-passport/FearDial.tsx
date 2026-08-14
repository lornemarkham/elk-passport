"use client";

import { motion } from "framer-motion";
import { INTENSITY_LEVELS, type Intensity } from "./content";

const TIER_ACCENT: Record<Intensity, string> = {
  cozy: "border-[#e0bd7d]/50 hover:bg-[#e0bd7d]/10",
  spooky: "border-[#ff5a1f]/50 hover:bg-[#ff5a1f]/10",
  creepy: "border-[#b8412b]/60 hover:bg-[#b8412b]/10",
  nightmare: "border-[#7a1a10]/70 hover:bg-[#7a1a10]/15",
};

/**
 * The Fear Dial (Phase 7.16) — a signature interaction, not a settings
 * screen. Asked once, ceremonially, after the cinematic intro and before
 * anything else: "How brave are you tonight?" The choice sets the
 * starting `Intensity` for the whole session (still changeable later from
 * the in-page selector, for anyone who wants to dial it up or down mid-
 * visit). Nightmare is genuinely opt-in — nothing about this screen
 * nudges toward it; all four tiles are visually equal, the visitor picks
 * what they picked.
 */
export function FearDial({
  onChoose,
}: {
  onChoose: (intensity: Intensity) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
      className="fixed inset-0 z-[55] flex flex-col items-center justify-center gap-10 bg-black px-6 text-center text-[#f3ead9]"
    >
      <div>
        <p className="text-xs font-medium tracking-[0.35em] uppercase opacity-40">
          The Fear Dial
        </p>
        <p className="font-heading mt-4 text-2xl md:text-3xl">
          How brave are you tonight?
        </p>
      </div>
      <div className="grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
        {INTENSITY_LEVELS.map((level, i) => (
          <motion.button
            key={level.id}
            type="button"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.12, duration: 0.6 }}
            onClick={() => onChoose(level.id)}
            className={`flex flex-col items-center gap-2 rounded-2xl border bg-white/[0.02] px-4 py-6 transition-colors ${TIER_ACCENT[level.id]}`}
          >
            <span className="text-3xl">{level.emoji}</span>
            <span className="font-heading text-sm">{level.label}</span>
          </motion.button>
        ))}
      </div>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.4 }}
        transition={{ delay: 0.8, duration: 1 }}
        className="max-w-xs text-xs italic"
      >
        You can change your mind later. This just decides where we start.
      </motion.p>
    </motion.div>
  );
}
