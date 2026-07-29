"use client";

import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { FieldExperience } from "./types";

interface MoodBoardProps {
  experiences: FieldExperience[];
  onRemove: (id: string) => void;
}

export function MoodBoard({ experiences, onRemove }: MoodBoardProps) {
  return (
    <aside className="pointer-events-none fixed inset-y-0 right-0 z-40 w-full max-w-[30%] min-w-[280px] border-l border-white/[0.06] bg-[#0b0b0b]/70 backdrop-blur-xl">
      <div className="pointer-events-auto flex h-full flex-col gap-6 overflow-y-auto px-6 py-10 sm:px-8">
        <header className="space-y-1">
          <p className="text-[11px] font-medium tracking-[0.2em] text-white/35 uppercase">
            Your board
          </p>
          <p className="font-heading text-lg text-white/70">
            {experiences.length === 0
              ? "Nothing yet — just look around."
              : `${experiences.length} discover${experiences.length === 1 ? "y" : "ies"} caught your eye`}
          </p>
        </header>

        <div className="flex flex-1 flex-col gap-3">
          <AnimatePresence initial={false}>
            {experiences.map((experience) => (
              <motion.button
                key={experience.id}
                type="button"
                layoutId={experience.id}
                layout="position"
                onClick={() => onRemove(experience.id)}
                initial={{ opacity: 0, rotate: experience.layout.rotate }}
                animate={{ opacity: 1, rotate: 0 }}
                exit={{
                  opacity: 0,
                  scale: 0.94,
                  transition: { duration: 0.3, ease: "easeIn" },
                }}
                transition={{
                  layout: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
                  opacity: { duration: 0.45, delay: 0.25, ease: "easeOut" },
                  rotate: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
                }}
                className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left backdrop-blur-md"
              >
                <div
                  className={cn(
                    "absolute -inset-6 rounded-full bg-linear-to-br opacity-60 blur-2xl",
                    experience.glow,
                  )}
                />
                <div className="relative flex items-center justify-between gap-3">
                  <div>
                    <p className="font-heading text-sm text-white/90">
                      {experience.name}
                    </p>
                    <p className="text-xs text-white/45">
                      {experience.tagline}
                    </p>
                  </div>
                  <span className="text-sm text-white/0 transition-colors duration-200 group-hover:text-white/40">
                    ×
                  </span>
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </aside>
  );
}
