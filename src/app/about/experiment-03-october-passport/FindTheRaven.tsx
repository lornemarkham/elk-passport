"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RAVEN_FOUND_LINE } from "./content";

/** Fixed positions, not randomized — randomizing per render would be an SSR/hydration hazard (the same class of bug this project has already found and documented in `useSoundscape`/`DiscoverySwipeExperiment`). A small, deterministic set to cycle through instead. */
const HIDING_SPOTS = [
  { top: "18%", left: "8%" },
  { top: "72%", left: "85%" },
  { top: "40%", left: "50%" },
  { top: "85%", left: "20%" },
];

/**
 * "Find the Hidden Raven" — a real, tiny click-hunt. The raven sits at
 * low opacity, blended into the section, genuinely easy to miss on a
 * first pass. Catching it cycles it to a new (still fixed, still
 * deterministic) spot, so the game is real and replayable within one
 * session, not a one-time gimmick.
 */
export function FindTheRaven() {
  const [spotIndex, setSpotIndex] = useState(0);
  const [caught, setCaught] = useState(false);
  const spot = HIDING_SPOTS[spotIndex % HIDING_SPOTS.length]!;

  function catchRaven() {
    setCaught(true);
    window.setTimeout(() => {
      setCaught(false);
      setSpotIndex((i) => i + 1);
    }, 2200);
  }

  return (
    <div className="relative h-40 overflow-hidden rounded-2xl border border-dashed border-current/20 bg-[#0a0704]">
      <p className="absolute inset-x-0 top-3 text-center text-xs italic opacity-40">
        A raven&apos;s hiding somewhere in here. Find it.
      </p>

      {!caught ? (
        <button
          type="button"
          onClick={catchRaven}
          aria-label="Find the raven"
          className="absolute text-xl opacity-25 transition-opacity hover:opacity-70"
          style={{ top: spot.top, left: spot.left }}
        >
          🐦‍⬛
        </button>
      ) : (
        <AnimatePresence>
          <motion.p
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="font-heading absolute inset-0 flex items-center justify-center px-6 text-center text-lg text-[#f3ead9]"
          >
            {RAVEN_FOUND_LINE}
          </motion.p>
        </AnimatePresence>
      )}
    </div>
  );
}
