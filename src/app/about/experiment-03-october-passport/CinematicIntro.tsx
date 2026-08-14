"use client";

import { motion, AnimatePresence } from "framer-motion";
import { CINEMATIC_INTRO_LINES } from "./content";

/**
 * The cinematic introduction — Passport inviting the visitor in before
 * anything else happens, rather than just rendering a page. A real gate:
 * the rest of the experience mounts underneath it regardless (nothing
 * depends on this having closed), but visually and emotionally, this is
 * the first thing anyone sees. Dismissed by a real click, never a timer
 * — the same "never autoplay, always an explicit gesture" discipline the
 * sound and camera features on this page already follow.
 */
export function CinematicIntro({ onEnter }: { onEnter: () => void }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.8 }}
        className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-10 bg-black px-6 text-center text-[#f3ead9]"
      >
        <p className="text-xs font-medium tracking-[0.35em] uppercase opacity-40">
          Before you begin
        </p>
        <div className="flex flex-col gap-4">
          {CINEMATIC_INTRO_LINES.map((item, i) => (
            <motion.p
              key={item.line}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 0.85, y: 0 }}
              transition={{ delay: 0.3 + i * 0.35, duration: 0.8 }}
              className="flex items-center justify-center gap-2 text-lg md:text-xl"
            >
              <span>{item.emoji}</span> {item.line}
            </motion.p>
          ))}
        </div>
        <motion.button
          type="button"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            delay: 0.3 + CINEMATIC_INTRO_LINES.length * 0.35 + 0.4,
            duration: 0.8,
          }}
          onClick={onEnter}
          className="mt-4 rounded-full border border-current/30 px-8 py-3 text-sm font-medium tracking-wide transition-colors hover:bg-white/10"
        >
          Enter
        </motion.button>
      </motion.div>
    </AnimatePresence>
  );
}
