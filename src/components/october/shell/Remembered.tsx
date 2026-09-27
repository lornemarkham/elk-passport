"use client";

import { useSyncExternalStore } from "react";
import { readOctoberMemory } from "@/lib/october/foundYou";

/**
 * **October remembers.** One line, on one surface, and nowhere else yet.
 *
 * The rule this establishes is worth more than the line: a completed encounter
 * leaves a mark that other October surfaces may notice. It is deliberately not
 * plastered across the product — recognition that happens everywhere is a
 * feature, and stops being recognition.
 *
 * Read as an external store with a fixed server answer of "no". The server
 * cannot know who this is, and the one unacceptable outcome is a greeting
 * rendered at a stranger.
 */
export function Remembered() {
  const seen = useSyncExternalStore(
    () => () => {},
    () => readOctoberMemory().found,
    () => false,
  );
  if (!seen) return null;
  return (
    <p
      data-testid="october-remembers"
      className="mt-3 text-sm text-[#d09a4e]/70 italic"
    >
      You&apos;ve been here before.
    </p>
  );
}
