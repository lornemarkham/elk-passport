"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  CONTROL_DELAY,
  DIM_AT,
  DIM_MS,
  EXIT_AT,
  LINE_GAP,
  LINE_IN,
  LINE_OUT,
  LINES,
  OPEN_DARK,
  PHOTO_IN,
  SPOKEN,
  THANKS_AT,
} from "./script";

/**
 * **October Has Been Here.**
 *
 * The first playable reading of *The Scariest Room in Your House*. October
 * asks for a photograph of the room you like least after dark, looks at it for
 * an uncomfortably long time, says three short things, and stops.
 *
 * ## The photograph never leaves the device
 *
 * It is read into an object URL and revoked on unmount. Nothing is uploaded,
 * nothing is stored, nothing is inspected — there is no server in this scene
 * at all. That is not a shortcut taken for the prototype; it is the honest
 * version of what October is doing, which is *looking* and nothing else.
 *
 * ## Why October knows nothing
 *
 * Every line here is written to be true of any room on earth. October never
 * describes the photograph, and if it ever did, the person would immediately
 * start grading it — and a description that can be graded can be wrong. The
 * unease comes from the one thing the scene can genuinely claim: that this
 * room is now known to something else.
 *
 * ## Motion
 *
 * Under `prefers-reduced-motion` the ambient loops (the breath on the image,
 * the pulse in the vignette) are dropped and the grain is left static. The
 * *schedule* is untouched — the pacing is the content, not decoration, and
 * removing it would leave a different scene rather than a calmer one.
 */
export function HasBeenHere() {
  const reduced = useReducedMotion() ?? false;

  /** -1 before anything; then an index into LINES. */
  const [line, setLine] = useState(-1);
  const [showControl, setShowControl] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  /** -1 = October is not speaking. */
  const [spoken, setSpoken] = useState(-1);
  const [dim, setDim] = useState(false);
  const [thanks, setThanks] = useState(false);
  const [exit, setExit] = useState(false);

  const objectUrl = useRef<string | null>(null);

  // ----------------------------------------------------------- the approach
  useEffect(() => {
    if (photo) return;
    if (line >= LINES.length - 1) return;
    const wait = line < 0 ? OPEN_DARK : LINES[line]!.hold + LINE_OUT + LINE_GAP;
    const t = setTimeout(() => setLine((n) => n + 1), wait);
    return () => clearTimeout(t);
  }, [line, photo]);

  // "Show me." has landed; the way to answer it follows a beat later.
  useEffect(() => {
    if (line !== LINES.length - 1) return;
    const t = setTimeout(() => setShowControl(true), CONTROL_DELAY);
    return () => clearTimeout(t);
  }, [line]);

  // ------------------------------------------------------------- the answer
  const choose = useCallback((file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    const url = URL.createObjectURL(file);
    objectUrl.current = url;
    setPhoto(url);
  }, []);

  useEffect(
    () => () => {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    },
    [],
  );

  // -------------------------------------------------------- the long look
  useEffect(() => {
    if (!photo) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, run: () => void) =>
      timers.push(setTimeout(run, ms));

    SPOKEN.forEach((s, i) => {
      at(s.at, () => setSpoken(i));
      // The last line is never withdrawn — it is still there when the room
      // goes dark underneath it.
      if (!s.stay) at(s.at + s.hold, () => setSpoken(-1));
    });
    const last = SPOKEN[SPOKEN.length - 1]!;
    at(last.at + last.hold, () => setSpoken(-1));

    at(DIM_AT, () => setDim(true));
    at(THANKS_AT, () => setThanks(true));
    at(EXIT_AT, () => setExit(true));

    return () => timers.forEach(clearTimeout);
  }, [photo]);

  const speaking = spoken >= 0 ? SPOKEN[spoken] : undefined;

  return (
    <main
      className="relative min-h-[100svh] overflow-hidden bg-black text-[#e9e6da]"
      // Tapping during the approach brings the next line forward. No
      // affordance, on purpose: it is there for the second time through, not
      // as an invitation to hurry the first.
      onClick={() => {
        if (!photo && line >= 0 && line < LINES.length - 1)
          setLine((n) => n + 1);
      }}
    >
      <style>{`
        @keyframes hbh-breathe {
          from { transform: scale(1.02); }
          to   { transform: scale(1.055); }
        }
        @keyframes hbh-attend {
          from { opacity: .46; }
          to   { opacity: .74; }
        }
      `}</style>

      {/* --------------------------------------------------- the photograph */}
      {photo ? (
        <div className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo}
            alt=""
            className="h-full w-full object-cover"
            style={{
              opacity: dim ? 0.12 : 1,
              filter: dim ? "brightness(0.5)" : "brightness(0.86)",
              transition: `opacity ${dim ? DIM_MS : PHOTO_IN}ms ease-in-out, filter ${dim ? DIM_MS : PHOTO_IN}ms ease-in-out`,
              animation: reduced
                ? undefined
                : "hbh-breathe 19s ease-in-out infinite alternate",
            }}
          />

          {/* Something paying attention, at the rate of slow breathing. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(115% 85% at 50% 42%, transparent 18%, rgba(0,0,0,0.72) 78%, #000 100%)",
              opacity: reduced ? 0.6 : undefined,
              animation: reduced
                ? undefined
                : "hbh-attend 9s ease-in-out infinite alternate",
            }}
          />

          {/* Grain. Generated, static, and barely there — enough to stop the
              image reading as a photo in a viewer. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.045] mix-blend-overlay"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)'/%3E%3C/svg%3E\")",
            }}
          />

          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2"
            style={{
              background:
                "linear-gradient(to top, rgba(0,0,0,0.85), transparent)",
            }}
          />
        </div>
      ) : null}

      {/* --------------------------------------------------------- the voice */}
      <div
        className={`relative flex min-h-[100svh] flex-col items-center px-7 ${
          photo ? "justify-end pb-[18vh]" : "justify-center"
        }`}
      >
        <AnimatePresence mode="wait">
          {/* The approach, alone on black. */}
          {!photo && line >= 0 ? (
            <motion.p
              key={`l${line}`}
              initial={{ opacity: 0 }}
              animate={{
                opacity: 1,
                transition: { duration: LINE_IN / 1000, ease: "easeOut" },
              }}
              exit={{
                opacity: 0,
                transition: { duration: LINE_OUT / 1000, ease: "easeIn" },
              }}
              className="font-heading max-w-md text-center text-2xl leading-snug text-balance text-[#f3efe4]/90 sm:text-3xl"
            >
              {LINES[line]!.text}
            </motion.p>
          ) : null}

          {/* What October says over the room. */}
          {photo && speaking ? (
            <motion.p
              key={`s${spoken}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.5, ease: "easeInOut" }}
              className="font-heading max-w-lg text-center text-2xl leading-snug text-balance text-[#f3efe4] sm:text-3xl"
              style={{ textShadow: "0 2px 30px rgba(0,0,0,0.9)" }}
            >
              {speaking.text}
            </motion.p>
          ) : null}

          {photo && !speaking && thanks ? (
            <motion.p
              key="thanks"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 2.4, ease: "easeInOut" }}
              className="text-center text-base text-[#e9e6da]/45"
            >
              Thank you.
            </motion.p>
          ) : null}
        </AnimatePresence>

        {/* ------------------------------------------------- the way to answer */}
        {!photo && showControl ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.6, ease: "easeOut" }}
            className="mt-12"
          >
            <label className="group block cursor-pointer">
              <input
                type="file"
                accept="image/*"
                className="peer sr-only"
                onChange={(e) => choose(e.target.files?.[0])}
              />
              {/* Roughly the proportions of the thing being asked for, so the
                  control reads as a place the room will go rather than as a
                  form field. */}
              <span className="flex h-36 w-60 flex-col items-center justify-center gap-2 rounded-sm border border-[#e9e6da]/15 bg-[#e9e6da]/[0.02] transition-colors group-hover:border-[#e9e6da]/35 group-hover:bg-[#e9e6da]/[0.05] peer-focus-visible:border-[#e9e6da]/60 sm:h-40 sm:w-72">
                <span className="font-heading text-lg text-[#f3efe4]/70">
                  The room
                </span>
                <span className="text-[10px] tracking-[0.2em] text-[#e9e6da]/30 lowercase">
                  camera or photos
                </span>
              </span>
            </label>
          </motion.div>
        ) : null}

        {/* ------------------------------------------------------- the way out */}
        {exit ? (
          <motion.a
            href="/labs/october/sketchbook"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 3, ease: "easeInOut" }}
            className="absolute bottom-10 text-sm text-[#e9e6da]/25 underline-offset-8 transition-colors hover:text-[#e9e6da]/55 hover:underline"
          >
            Turn the light on.
          </motion.a>
        ) : null}
      </div>
    </main>
  );
}
