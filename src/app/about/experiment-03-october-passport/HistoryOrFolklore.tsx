"use client";

import { useState } from "react";
import { HelpCircle } from "lucide-react";
import {
  LOCAL_LEGENDS,
  HISTORY_OR_FOLKLORE_INTRO,
  type LocalLegend,
} from "./content";

const QUIZZABLE: readonly LocalLegend[] = LOCAL_LEGENDS.filter(
  (l) => l.kind !== "Concept / Example",
);

type Guess = "Documented" | "Local Legend";

/**
 * "History or Folklore?" — a real mini-game built entirely from the
 * genuinely sourced entries in `LOCAL_LEGENDS` (the three "Concept /
 * Example" cards are excluded — they have no real answer to guess). Fun
 * first, per the brief, but also a real reinforcement of "respect
 * history": guessing wrong is exactly as likely as guessing right, on
 * purpose, because the whole point of labeling every entry honestly is
 * that a real legend and a documented fact can read identically until
 * you check.
 */
export function HistoryOrFolklore() {
  const [index, setIndex] = useState(0);
  const [guess, setGuess] = useState<Guess | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0 });

  const current = QUIZZABLE[index % QUIZZABLE.length]!;
  const correct = current.kind === guess;

  function makeGuess(g: Guess) {
    if (guess) return;
    setGuess(g);
    setScore((s) => ({
      right: s.right + (g === current.kind ? 1 : 0),
      total: s.total + 1,
    }));
  }

  function next() {
    setGuess(null);
    setIndex((i) => (i + 1) % QUIZZABLE.length);
  }

  return (
    <div className="flex flex-col items-center gap-5 rounded-2xl border border-current/15 p-8 text-center">
      <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.15em] uppercase opacity-50">
        <HelpCircle className="h-3.5 w-3.5" /> History or Folklore?
      </p>
      <p className="max-w-sm text-sm opacity-60">{HISTORY_OR_FOLKLORE_INTRO}</p>

      <p className="font-heading max-w-md text-lg leading-snug">
        {current.title}
      </p>
      <p className="max-w-md text-sm leading-relaxed italic opacity-70">
        {current.fact}
      </p>

      {!guess ? (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => makeGuess("Documented")}
            className="rounded-full border border-current/20 px-4 py-2 text-sm font-medium transition-colors hover:bg-current/5"
          >
            Documented Fact
          </button>
          <button
            type="button"
            onClick={() => makeGuess("Local Legend")}
            className="rounded-full border border-current/20 px-4 py-2 text-sm font-medium transition-colors hover:bg-current/5"
          >
            Local Legend
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <p
            className={`font-heading text-lg ${correct ? "text-[#ff5a1f]" : "opacity-70"}`}
          >
            {correct ? "Correct." : "Not quite."} It&apos;s a {current.kind}.
          </p>
          {current.source && (
            <p className="text-xs opacity-40">Source: {current.source}</p>
          )}
          <button
            type="button"
            onClick={next}
            className="mt-2 rounded-full bg-[#ff5a1f] px-5 py-2 text-sm font-bold text-[#171208]"
          >
            Next
          </button>
        </div>
      )}

      <p className="text-xs opacity-40">
        {score.right} / {score.total} so far
      </p>
    </div>
  );
}
