"use client";

import { useState } from "react";
import { FlaskConical, RotateCcw, X } from "lucide-react";
import { Avatar } from "./atoms";
import { phaseTimes } from "../core/phase";
import type { LiveExperience } from "../core/engine";

/**
 * **Lab instrument, not product.**
 *
 * An experience is a function of *when you open it*, and that is impossible
 * to evaluate at the speed of real life. This bar moves `now` and switches
 * who you are, so the whole lifecycle — sealed picks, the lock, the
 * leaderboard filling in, the morning after, the next one — can be walked
 * through in ten seconds.
 *
 * It is styled as an obviously foreign object on purpose. Nothing here is
 * proposed as a Passport feature, and the day it starts looking like one is
 * the day it should be deleted.
 */
export function TimeMachine({
  live,
  onSetNow,
  onBecome,
  onReset,
}: {
  live: LiveExperience;
  onSetNow: (iso: string | null) => void;
  onBecome: (id: string | null) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const times = phaseTimes(live.definition);

  /**
   * Jumping lands *inside* a phase rather than on its first second — landing
   * on the boundary showed every phase at its emptiest, which made the
   * lifecycle look like a set of blank screens instead of a night unfolding.
   *
   * Capped at six hours in, because the last phases are weeks long and
   * "the morning after" should read as the morning after, not as eleven days
   * later.
   */
  const intoPhase = (index: number): string => {
    const start = times[index].at.getTime();
    const end = times[index + 1]?.at.getTime() ?? start + 3 * 3_600_000;
    const offset = Math.min((end - start) * 0.95, 6 * 3_600_000);
    return new Date(start + offset).toISOString();
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-4 z-50 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/80 px-3.5 py-2 text-[12.5px] font-medium text-white/80 backdrop-blur transition hover:text-white"
      >
        <FlaskConical className="h-3.5 w-3.5" />
        Lab
      </button>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-white/15 bg-black/90 px-4 pt-3 pb-4 backdrop-blur">
      <div className="mx-auto flex max-w-2xl flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-[11.5px] font-medium tracking-wide text-white/50 uppercase">
            <FlaskConical className="h-3.5 w-3.5" />
            Lab controls — not part of the product
          </p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-white/45 hover:text-white"
            aria-label="Close lab controls"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div>
          <p className="mb-1.5 text-[11.5px] text-white/40">Jump to</p>
          <div className="flex flex-wrap gap-1.5">
            {times.map(({ phase }, index) => (
              <button
                key={phase.id}
                type="button"
                onClick={() => onSetNow(intoPhase(index))}
                className={`rounded-full border px-3 py-1.5 text-[12.5px] transition ${
                  live.phase.id === phase.id
                    ? "border-white/70 bg-white text-black"
                    : "border-white/15 text-white/65 hover:border-white/40"
                }`}
              >
                {phase.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => onSetNow(null)}
              className="rounded-full border border-white/15 px-3 py-1.5 text-[12.5px] text-white/50 transition hover:border-white/40"
            >
              Real time
            </button>
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[11.5px] text-white/40">You are</p>
          <div className="flex flex-wrap gap-1.5">
            {live.participants.map((person) => (
              <button
                key={person.id}
                type="button"
                onClick={() => onBecome(person.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[12.5px] transition ${
                  live.me?.id === person.id
                    ? "border-white/70 bg-white/15 text-white"
                    : "border-white/15 text-white/60 hover:border-white/40"
                }`}
              >
                <Avatar person={person} size={18} />
                {person.name}
              </button>
            ))}
            <button
              type="button"
              onClick={() => onBecome(null)}
              className="rounded-full border border-white/15 px-3 py-1.5 text-[12.5px] text-white/50 transition hover:border-white/40"
            >
              Nobody
            </button>
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-[12.5px] text-white/50 transition hover:border-white/40"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
