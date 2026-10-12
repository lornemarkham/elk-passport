"use client";

import { useState } from "react";
import { motion } from "framer-motion";

/**
 * **Stay Inside Tonight — a surface, not a scene.**
 *
 * Witching Hour's job is to be a doorway. After the door, the person is
 * handed this: a small, readable place to actually pick something. It is
 * deliberately plainer than the night behind it — bible §3.1, a surface lets
 * the person do something with the feeling — and it is fixture-backed and
 * says so.
 *
 * Four choices, four authored answers. Not Movie Night. Enough to prove the
 * lifecycle: cinema → choice → payoff → useful Passport.
 */
interface Option {
  id: string;
  label: string;
  whisper: string;
  answer: { title: string; body: string; note: string };
}

const OPTIONS: readonly Option[] = [
  {
    id: "watch",
    label: "Watch something",
    whisper: "Creepy, not gory. Ninety minutes.",
    answer: {
      title: "The Others (2001)",
      body: "A big house, a mother, children who cannot be in daylight. Almost nothing is shown. Everything is heard.",
      note: "One pick, matched to your Fear Dial. Fixture — Movie Night will do this properly.",
    },
  },
  {
    id: "story",
    label: "Tell me something creepy",
    whisper: "About somewhere near here.",
    answer: {
      title: "The Towne Cinema, Vernon",
      body: "Staff have described footsteps in the projection booth after closing, for years, and nobody agrees on whose. Documented as a story people tell — not as a fact.",
      note: "Provenance: local legend, from the existing October experiment's sourced list. Fixture.",
    },
  },
  {
    id: "make",
    label: "Make something",
    whisper: "Warm. Twenty minutes.",
    answer: {
      title: "Mulled cider",
      body: "Apple cider, a cinnamon stick, four cloves, a strip of orange peel. Low heat, do not boil, twenty minutes. Drink it by the darkest window you have.",
      note: "Fixture. A Recipe Thing does not exist in Atlas yet, and that is fine.",
    },
  },
  {
    id: "surprise",
    label: "Surprise me",
    whisper: "October chooses.",
    answer: {
      title: "Turn the lights off first.",
      body: "Then watch the film. October will remember whether you made it to the end.",
      note: "Fixture. The real version reads what you have done this October.",
    },
  },
];

export function StayInside({ onLeave }: { onLeave: () => void }) {
  const [chosen, setChosen] = useState<Option | null>(null);

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1.1, ease: [0.22, 0.61, 0.36, 1] }}
      className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-md rounded-t-2xl border-t border-[#e9e6da]/10 bg-[#0b0d14]/95 px-6 pt-6 pb-8 backdrop-blur-sm"
      aria-label="Stay inside tonight"
      data-testid="stay-inside"
    >
      <p className="font-mono text-[10px] tracking-[0.25em] text-[#e9e6da]/40 uppercase">
        Stay inside tonight
      </p>

      {!chosen ? (
        <ul className="mt-4 flex flex-col">
          {OPTIONS.map((option, i) => (
            <motion.li
              key={option.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.5 + i * 0.16 }}
            >
              <button
                type="button"
                onClick={() => setChosen(option)}
                className="flex min-h-14 w-full flex-col items-start rounded-md px-3 py-2.5 text-left transition-colors hover:bg-white/[0.05]"
              >
                <span className="font-serif text-lg text-[#e9e6da]">
                  {option.label}
                </span>
                <span className="text-xs text-[#e9e6da]/45">
                  {option.whisper}
                </span>
              </button>
            </motion.li>
          ))}
        </ul>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="mt-4"
        >
          <h2 className="font-serif text-2xl text-[#e9e6da]">
            {chosen.answer.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[#e9e6da]/75">
            {chosen.answer.body}
          </p>
          <p className="mt-4 font-mono text-[10px] tracking-wide text-[#e9e6da]/35 uppercase">
            {chosen.answer.note}
          </p>
          <div className="mt-6 flex items-center gap-6">
            <button
              type="button"
              onClick={() => setChosen(null)}
              className="min-h-11 text-sm text-[#e9e6da]/60 underline-offset-4 hover:underline"
            >
              something else
            </button>
            <button
              type="button"
              onClick={onLeave}
              className="min-h-11 text-sm text-[#e9e6da]/60 underline-offset-4 hover:underline"
            >
              back to October
            </button>
          </div>
        </motion.div>
      )}
    </motion.section>
  );
}
