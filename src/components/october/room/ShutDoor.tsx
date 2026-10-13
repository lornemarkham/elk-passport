"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  answerToKnock,
  doorLine,
  type Threshold,
} from "@/domain/october/threshold";
import { armRoomAudio, felt, play, stopRoomAudio } from "./roomAudio";

/**
 * **The door, before it opens.**
 *
 * The Secret Room is foreshadowed over days (bible §9.7), and this is what a
 * person finds when they try it early: one door in the dark, and what it says.
 * Nothing explains it. The only thing to do is knock, and October answers —
 * mildly, and never twice the same in a row.
 *
 * The light under the door tells the date as well as the words do: dark at
 * first, an occasional line of it later, and steady in the last six nights.
 * Reduced motion gets the steady light and none of the flicker.
 */
export function ShutDoor({ threshold }: { readonly threshold: Threshold }) {
  const reduced = useReducedMotion() ?? false;
  const [answer, setAnswer] = useState<string | null>(null);
  const knocks = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const running = timers.current;
    return () => {
      for (const t of running) clearTimeout(t);
      stopRoomAudio();
    };
  }, []);

  const knock = useCallback(() => {
    armRoomAudio();
    knocks.current += 1;
    play("thud", 1.1);
    timers.current.push(setTimeout(() => play("thud", 0.9), 170));
    felt([30, 90, 30]);
    // October takes a breath before it answers.
    timers.current.push(
      setTimeout(() => {
        setAnswer(answerToKnock(threshold, knocks.current));
        timers.current.push(setTimeout(() => setAnswer(null), 3800));
      }, 900),
    );
  }, [threshold]);

  const lit = threshold.kind === "counting";
  const flickers = threshold.kind === "light" && !reduced;
  const glow = "0 0 22px 3px rgba(255,207,138,0.5)";

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center overflow-hidden bg-[#050407] text-[#e9e6da] select-none"
      data-testid="shut-door"
      data-threshold={threshold.kind}
      data-nights={"nights" in threshold ? threshold.nights : undefined}
    >
      <style>{`
        @keyframes shut-light { 0%,86%,100% { opacity:0 } 88% { opacity:.9 } 90% { opacity:.1 } 93% { opacity:.7 } 97% { opacity:0 } }
      `}</style>

      <button
        type="button"
        onClick={knock}
        data-testid="shut-door-knock"
        aria-label="Knock on the door"
        className="relative h-[46svh] max-h-[26rem] min-h-52 w-[min(54vw,14rem)] cursor-pointer rounded-t-md border border-[#e9e6da]/10 bg-[#120f12] transition-colors hover:bg-[#161216] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d09a4e]"
      >
        <span className="absolute inset-x-3 top-4 bottom-1/2 rounded-sm border border-[#e9e6da]/[0.06]" />
        <span className="absolute inset-x-3 top-1/2 bottom-6 mt-3 rounded-sm border border-[#e9e6da]/[0.06]" />
        <span className="absolute top-[52%] right-3 h-1.5 w-1.5 rounded-full bg-[#c9b58c]/40" />
        {lit || flickers ? (
          <span
            data-testid="shut-door-light"
            aria-hidden
            className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-[#ffcf8a]"
            style={{
              boxShadow: glow,
              opacity: lit ? 0.85 : undefined,
              animation: flickers
                ? "shut-light 11s linear infinite"
                : undefined,
            }}
          />
        ) : null}
      </button>

      <p
        data-testid="shut-door-line"
        className="font-heading mt-10 text-3xl text-[#f3efe4] sm:text-4xl"
        style={{ textShadow: "0 2px 24px rgba(0,0,0,0.9)" }}
      >
        {doorLine(threshold)}
      </p>

      <div className="mt-5 flex h-8 items-center justify-center px-8">
        <AnimatePresence mode="wait">
          {answer ? (
            <motion.p
              key={answer}
              data-testid="shut-door-answer"
              aria-live="polite"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.7, transition: { duration: 1.2 } }}
              exit={{ opacity: 0, transition: { duration: 1.4 } }}
              className="text-center text-base text-[#e9e6da] italic"
            >
              {answer}
            </motion.p>
          ) : null}
        </AnimatePresence>
      </div>

      <Link
        href="/october/from"
        data-testid="shut-door-leave"
        onClick={() => stopRoomAudio()}
        className="absolute bottom-8 min-h-11 rounded-full px-6 py-2.5 text-sm tracking-wide text-[#e9e6da]/40 transition-colors hover:text-[#e9e6da]/70"
      >
        Leave it.
      </Link>
    </div>
  );
}
