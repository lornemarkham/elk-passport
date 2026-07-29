"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { FieldExperience } from "./types";

type BoardTab = "saved" | "shelved";

interface MoodBoardProps {
  savedExperiences: FieldExperience[];
  shelvedExperiences: FieldExperience[];
  onRemoveSaved: (id: string) => void;
  onReturnShelved: (id: string) => void;
  rejectedCount: number;
  hasActiveFilters: boolean;
  onRestoreRejected: () => void;
  onClearFilters: () => void;
}

function BoardRow({
  experience,
  onAction,
  actionLabel,
}: {
  experience: FieldExperience;
  onAction: () => void;
  actionLabel: string;
}) {
  return (
    <motion.button
      type="button"
      layoutId={experience.id}
      layout="position"
      onClick={onAction}
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
      aria-label={`${actionLabel} ${experience.name}`}
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
          <p className="text-xs text-white/45">{experience.tagline}</p>
        </div>
        <span className="text-[11px] text-white/0 transition-colors duration-200 group-hover:text-white/40">
          {actionLabel}
        </span>
      </div>
    </motion.button>
  );
}

export function MoodBoard({
  savedExperiences,
  shelvedExperiences,
  onRemoveSaved,
  onReturnShelved,
  rejectedCount,
  hasActiveFilters,
  onRestoreRejected,
  onClearFilters,
}: MoodBoardProps) {
  const [tab, setTab] = useState<BoardTab>("saved");
  const canBroaden = hasActiveFilters || rejectedCount > 0;
  const visible = tab === "saved" ? savedExperiences : shelvedExperiences;

  return (
    <aside className="pointer-events-none fixed inset-y-0 right-0 z-40 w-full max-w-[30%] min-w-[280px] border-l border-white/[0.06] bg-[#0b0b0b]/70 backdrop-blur-xl">
      <div className="pointer-events-auto flex h-full flex-col gap-5 overflow-y-auto px-6 py-10 sm:px-8">
        <header className="space-y-3">
          <p className="text-[11px] font-medium tracking-[0.2em] text-white/35 uppercase">
            Your board
          </p>
          <div className="flex gap-1.5" role="tablist" aria-label="Mood Board">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "saved"}
              onClick={() => setTab("saved")}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                tab === "saved"
                  ? "border-white/30 bg-white/[0.08] text-white/90"
                  : "border-white/10 text-white/45 hover:text-white/70",
              )}
            >
              Saved ({savedExperiences.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "shelved"}
              onClick={() => setTab("shelved")}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                tab === "shelved"
                  ? "border-white/30 bg-white/[0.08] text-white/90"
                  : "border-white/10 text-white/45 hover:text-white/70",
              )}
            >
              Shelved ({shelvedExperiences.length})
            </button>
          </div>
          <p className="font-heading text-sm text-white/60">
            {visible.length === 0
              ? tab === "saved"
                ? "Nothing yet — just look around."
                : "Nothing shelved. Shelf something interesting for later."
              : tab === "saved"
                ? `${savedExperiences.length} discover${savedExperiences.length === 1 ? "y" : "ies"} caught your eye`
                : `${shelvedExperiences.length} set aside for later`}
          </p>
        </header>

        <div className="flex flex-1 flex-col gap-3">
          <AnimatePresence initial={false}>
            {visible.map((experience) =>
              tab === "saved" ? (
                <BoardRow
                  key={experience.id}
                  experience={experience}
                  onAction={() => onRemoveSaved(experience.id)}
                  actionLabel="Remove"
                />
              ) : (
                <BoardRow
                  key={experience.id}
                  experience={experience}
                  onAction={() => onReturnShelved(experience.id)}
                  actionLabel="Return to Discovery"
                />
              ),
            )}
          </AnimatePresence>
        </div>

        {canBroaden && (
          <footer className="space-y-2 border-t border-white/10 pt-4">
            <p className="text-[11px] font-medium tracking-[0.15em] text-white/35 uppercase">
              Feeling boxed in?
            </p>
            <div className="flex flex-wrap gap-2">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={onClearFilters}
                  className="rounded-full border border-white/15 bg-white/[0.03] px-3 py-1.5 text-xs text-white/70 transition-colors hover:border-white/30 hover:text-white"
                >
                  Clear filters
                </button>
              )}
              {rejectedCount > 0 && (
                <button
                  type="button"
                  onClick={onRestoreRejected}
                  className="rounded-full border border-white/15 bg-white/[0.03] px-3 py-1.5 text-xs text-white/70 transition-colors hover:border-white/30 hover:text-white"
                >
                  Bring back {rejectedCount} passed-on{" "}
                  {rejectedCount === 1 ? "idea" : "ideas"}
                </button>
              )}
            </div>
          </footer>
        )}
      </div>
    </aside>
  );
}
