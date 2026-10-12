"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { readOctoberMemory } from "@/lib/october/foundYou";

/**
 * **The way in.** One line at the very bottom of Discover, under everything
 * a person came for, and a door into Found You.
 *
 * It is the only entrance from the public product into October herself, and
 * it is built to be come across rather than shown: no card, no eyebrow, no
 * icon, nothing that says *experience*. It sits where you only arrive by
 * going past everything else, which is what the first line is about.
 *
 * ## Two lines, and only one is ever true
 *
 * - **Somebody she has met** — a completed Found You recorded in this
 *   browser — reads *"You've been here before."* It is a fact, and it is
 *   only ever said when it is one.
 * - **Everybody else** reads *"You walked right past me."* That is also
 *   true: they did, all the way down the page. It plants the thing Found You
 *   pays off ("They walked right by me."), and it is just strange enough to
 *   follow.
 *
 * The server cannot know who this is, so it renders nothing and the browser
 * decides — never a greeting rendered at a stranger and corrected a frame
 * later. Recognition stays on this one surface: everywhere would make it a
 * feature, and it would stop being recognition.
 *
 * ## Still a link
 *
 * Quiet is not the same as hidden. It is a real link with its sentence as its
 * name, 44px tall for a thumb, and the colour clears 4.5:1 on October's
 * background so it can be read by anyone who gets this far.
 */
export const BEEN_HERE = "You've been here before.";
export const WALKED_PAST = "You walked right past me.";

type Seen = "unknown" | "met" | "stranger";

export function Remembered() {
  const seen = useSyncExternalStore<Seen>(
    () => () => {},
    () => (readOctoberMemory().found ? "met" : "stranger"),
    () => "unknown",
  );
  if (seen === "unknown") return null;
  return (
    <p className="mt-24 text-center">
      <Link
        href="/october/found-you"
        data-testid="october-remembers"
        data-seen={seen}
        className="inline-flex min-h-11 items-center px-2 text-sm text-[#d09a4e]/75 italic underline-offset-8 transition-colors hover:text-[#d09a4e] hover:underline focus-visible:ring-1 focus-visible:ring-[#d09a4e] focus-visible:outline-none"
      >
        {seen === "met" ? BEEN_HERE : WALKED_PAST}
      </Link>
    </p>
  );
}
