"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { Fear } from "@/lib/movies/catalogue";
import type { Verdict } from "@/lib/movies/types";

/**
 * **Two taps, and occasionally a third.**
 *
 * Loved / good / meh, then how frightening it actually was. Both are the
 * person's own word — nothing is inferred from whether they finished it.
 *
 * The third question is asked **occasionally, not every time**: repetition is
 * what turns a question into a form, and a form is what My October is not
 * (§28.1). It appears when their answer is interesting — when what they felt
 * differs from what the catalogue expected, or when they loved something
 * frightening — because that is when the answer is worth having.
 */
const VERDICTS: readonly { id: Verdict; label: string }[] = [
  { id: "loved", label: "Loved it" },
  { id: "good", label: "Good" },
  { id: "meh", label: "Meh" },
];

const FELT: readonly { id: Fear; label: string; emoji: string }[] = [
  { id: "cozy", label: "Not at all", emoji: "🙂" },
  { id: "spooky", label: "A bit", emoji: "🎃" },
  { id: "creepy", label: "Properly", emoji: "👻" },
  { id: "nightmare", label: "Too much", emoji: "💀" },
];

const MECHANISMS = [
  "dread",
  "the unseen",
  "jump",
  "reality-wrong",
  "isolation",
  "uncanny",
  "being watched",
  "too real",
  "helplessness",
] as const;

/**
 * Whether this answer is worth a follow-up. Not random — a surprise is what
 * makes the question earn its place.
 */
export function shouldAskWhat(
  felt: Fear,
  expected: Fear | undefined,
  verdict: Verdict,
): boolean {
  if (!expected) return false;
  if (felt !== expected) return true;
  return verdict === "loved" && (felt === "creepy" || felt === "nightmare");
}

export function FilmReaction({
  expected,
  onDone,
}: {
  /** What the catalogue thought. Used only to decide whether to ask more. */
  expected?: Fear;
  onDone: (r: { verdict: Verdict; felt: Fear; gotMe?: string }) => void;
}) {
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [felt, setFelt] = useState<Fear | null>(null);

  if (verdict && felt && shouldAskWhat(felt, expected, verdict)) {
    return (
      <div className="mt-3" data-testid="what-got-you">
        <p className="text-xs text-[#2b2015]/60">What got you?</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {MECHANISMS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onDone({ verdict, felt, gotMe: m })}
              className="min-h-9 rounded-full border border-[#8a5a24]/30 px-2.5 text-xs text-[#8a5a24] hover:bg-[#8a5a24]/10"
            >
              {m}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onDone({ verdict, felt })}
            className="min-h-9 px-2 text-xs text-[#2b2015]/40 underline-offset-4 hover:underline"
          >
            skip
          </button>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mt-3"
    >
      {!verdict ? (
        <div data-testid="verdict">
          <p className="text-xs text-[#2b2015]/60">How was it?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {VERDICTS.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setVerdict(v.id)}
                data-testid={`verdict-${v.id}`}
                className="min-h-9 rounded-full border border-[#8a5a24]/30 px-3 text-xs font-medium text-[#8a5a24] hover:bg-[#8a5a24]/10"
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div data-testid="felt">
          <p className="text-xs text-[#2b2015]/60">And how scary, actually?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {FELT.map((f) => (
              <button
                key={f.id}
                type="button"
                data-testid={`felt-${f.id}`}
                onClick={() => {
                  setFelt(f.id);
                  if (!shouldAskWhat(f.id, expected, verdict)) {
                    onDone({ verdict, felt: f.id });
                  }
                }}
                className="min-h-9 rounded-full border border-[#8a5a24]/30 px-3 text-xs text-[#8a5a24] hover:bg-[#8a5a24]/10"
              >
                <span aria-hidden>{f.emoji}</span> {f.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
