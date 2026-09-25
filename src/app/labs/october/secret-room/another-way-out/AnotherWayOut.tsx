"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CandleGame } from "./CandleGame";
import {
  FAILED,
  HOTSPOTS,
  LINE_GAP,
  LINE_IN,
  LINE_OUT,
  LOOK_MS,
  LOOK_TOUCHES,
  OFFER,
  OPENED,
  type Line,
} from "./script";

/**
 * **Another Way Out.** One room, and one of the ways October lets you leave it.
 *
 * You are already inside and already stuck; there is a real exit and you will
 * not find it, because in this prototype there isn't one. After a short while
 * of trying, October offers an alternative, and the alternative is a game.
 *
 * ## One place, four states
 *
 * The room is the same DOM the whole way through — it is never swapped out for
 * a game screen or a results screen. October's lines appear over it, the
 * candle is lit *in* it, and the door at the back is the same door you rattled
 * at the start and the one that finally opens. Three pages pretending to be an
 * experience is exactly what this is trying not to be.
 *
 * ## Deliberately not built
 *
 * There is no exit-picker, no second game, no framework and no lore. The
 * sketchbook holds the idea that the room has many ways out; this is one of
 * them, made once, to find out whether it is any fun.
 */

type Phase = "looking" | "offer" | "game" | "failed" | "opened";

export function AnotherWayOut() {
  const reduced = useReducedMotion() ?? false;

  const [phase, setPhase] = useState<Phase>("looking");
  const [touched, setTouched] = useState<string[]>([]);
  const [found, setFound] = useState<string | null>(null);
  /** Index into whichever line list the current phase speaks. */
  const [line, setLine] = useState(-1);
  const [exit, setExit] = useState(false);
  /** Terminal. October has said the last thing it is going to say. */
  const [finished, setFinished] = useState(false);

  const speaking: readonly Line[] = useMemo(
    () =>
      phase === "offer"
        ? OFFER
        : phase === "failed"
          ? FAILED
          : phase === "opened"
            ? OPENED
            : [],
    [phase],
  );

  // --------------------------------------------------------- looking around
  useEffect(() => {
    if (phase !== "looking") return;
    const t = setTimeout(() => setPhase("offer"), LOOK_MS);
    return () => clearTimeout(t);
  }, [phase]);

  const touch = useCallback(
    (id: string, says: string) => {
      if (phase !== "looking") return;
      setFound(says);
      setTouched((prev) => (prev.includes(id) ? prev : [...prev, id]));
    },
    [phase],
  );

  // Somebody who has tried four things has understood the room. No reason to
  // make them sit out the rest of the clock.
  useEffect(() => {
    if (phase !== "looking" || touched.length < LOOK_TOUCHES) return;
    const t = setTimeout(() => setPhase("offer"), 1400);
    return () => clearTimeout(t);
  }, [touched, phase]);

  useEffect(() => {
    if (!found) return;
    const t = setTimeout(() => setFound(null), 2600);
    return () => clearTimeout(t);
  }, [found]);

  /** What follows the last thing October said in this phase. */
  const afterSpeaking = useCallback(() => {
    // The end. The last line is deliberately *not* cleared — it stays over
    // the open door with the way out underneath it. Resetting the index here
    // also restarted the sequence, because the phase does not change again.
    if (phase === "opened") {
      setFinished(true);
      setExit(true);
      return;
    }
    setLine(-1);
    setPhase("game");
  }, [phase]);

  // ------------------------------------------------------------ the speaking
  //
  // The index never runs past the last line: the end of a phase is handled
  // here, inside the timer, rather than by letting `line` overshoot and having
  // a second effect notice. One less state in flight, and no phase change
  // happening synchronously inside a render.
  useEffect(() => {
    if (speaking.length === 0 || finished) return;
    if (line < 0) {
      const t = setTimeout(() => setLine(0), 900);
      return () => clearTimeout(t);
    }
    const wait = speaking[line]!.hold + LINE_OUT + LINE_GAP;
    const t = setTimeout(() => {
      if (line < speaking.length - 1) setLine((n) => n + 1);
      else afterSpeaking();
    }, wait);
    return () => clearTimeout(t);
  }, [line, speaking, afterSpeaking, finished]);

  const win = useCallback(() => {
    setLine(-1);
    setPhase("opened");
  }, []);
  const lose = useCallback(() => {
    setLine(-1);
    setPhase("failed");
  }, []);

  // Dark from the moment October speaks until the door actually opens —
  // including while it is being dry about the candle going out. The room
  // brightening between attempts made losing feel like leaving the scene.
  const dark = phase !== "looking" && phase !== "opened";
  const current =
    line >= 0 && line < speaking.length ? speaking[line] : undefined;

  return (
    <main
      className="relative min-h-[100svh] overflow-hidden bg-[#08070a] text-[#e9e6da] select-none"
      onClick={() => {
        if (current && line < speaking.length - 1) setLine((n) => n + 1);
      }}
    >
      <style>{`
        @keyframes awo-seam { from { opacity:.25 } to { opacity:.5 } }
      `}</style>

      {/* ===================================================== THE ROOM ==== */}
      <div className="absolute inset-0">
        {/* Back wall, and a floor that catches a little more light. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(#141118 0%, #17131a 52%, #0d0b10 66%, #0a080c 100%)",
          }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-[34%]"
          style={{
            background:
              "linear-gradient(to bottom, rgba(60,48,40,0.22), rgba(0,0,0,0.6))",
          }}
        />

        {/* The door. Shut, and lit from the other side just enough to be
            worth trying — this is the exit that finally opens. */}
        <div
          className="absolute"
          style={{ left: "40%", top: "26%", width: "20%", height: "48%" }}
        >
          <div className="absolute inset-0 rounded-t-[6px] border border-[#e9e6da]/[0.07] bg-gradient-to-b from-[#241d22] to-[#181318]" />
          <div className="absolute inset-[12%] rounded-[3px] border border-[#e9e6da]/[0.05]" />
          <div className="absolute top-[52%] right-[14%] h-[3%] w-[6%] rounded-full bg-[#c9b58c]/25" />
          <div
            className="absolute inset-x-[4%] bottom-0 h-[2px] bg-[#ffcf8a]"
            style={{
              filter: "blur(1.5px)",
              animation: reduced
                ? undefined
                : "awo-seam 5s ease-in-out infinite alternate",
              opacity: 0.35,
            }}
          />
          {/* On the way out, light takes the whole door. */}
          <AnimatePresence>
            {phase === "opened" ? (
              <motion.div
                initial={{ opacity: 0, scaleX: 0.04 }}
                animate={{ opacity: 1, scaleX: 1 }}
                transition={{ duration: 2.6, ease: "easeInOut" }}
                className="absolute inset-0 origin-left rounded-t-[6px]"
                style={{
                  background:
                    "linear-gradient(to right, rgba(255,226,176,0.95), rgba(255,196,120,0.55))",
                  boxShadow: "0 0 140px 50px rgba(255,190,110,0.5)",
                }}
              />
            ) : null}
          </AnimatePresence>
        </div>

        {/* Something reflective. */}
        <div
          className="absolute rounded-[2px] border border-[#e9e6da]/[0.06]"
          style={{
            left: "17%",
            top: "34%",
            width: "13%",
            height: "18%",
            background:
              "linear-gradient(145deg, rgba(180,190,205,0.07), rgba(20,20,28,0.5) 60%)",
          }}
        />
        {/* A shelf with nothing on it. */}
        <div
          className="absolute bg-[#2a2128]"
          style={{ left: "74%", top: "38%", width: "18%", height: "1.1%" }}
        />
        {/* A switch. */}
        <div
          className="absolute rounded-[2px] bg-[#2e2830]"
          style={{ left: "64.5%", top: "46%", width: "2.2%", height: "3.4%" }}
        />
        {/* A rug. */}
        <div
          className="absolute rounded-[50%]"
          style={{
            left: "26%",
            top: "76%",
            width: "26%",
            height: "12%",
            background:
              "radial-gradient(closest-side, rgba(92,58,46,0.42), rgba(52,32,26,0.12))",
          }}
        />

        {/* Grain, so the flat fills read as a place rather than as CSS. */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 90% at 50% 45%, transparent 25%, rgba(0,0,0,0.78) 100%)",
          }}
        />
      </div>

      {/* The room recedes once October is talking, and stays down while the
          candle is the only thing lighting it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-black transition-opacity duration-[2200ms]"
        style={{ opacity: dark ? 0.72 : 0 }}
      />

      {/* ================================================ THINGS TO TRY ==== */}
      {phase === "looking"
        ? HOTSPOTS.map((h) => (
            <button
              key={h.id}
              type="button"
              aria-label={h.label}
              onClick={() => touch(h.id, h.says)}
              className="absolute cursor-pointer rounded-sm transition-[box-shadow] duration-500 outline-none hover:shadow-[inset_0_0_40px_rgba(255,214,150,0.09)] focus-visible:shadow-[inset_0_0_40px_rgba(255,214,150,0.16)]"
              style={{
                left: `${h.x}%`,
                top: `${h.y}%`,
                width: `${h.w}%`,
                height: `${h.h}%`,
              }}
            />
          ))
        : null}

      {/* ====================================================== THE GAME ==== */}
      {phase === "game" ? (
        <CandleGame reduced={reduced} onWin={win} onLose={lose} />
      ) : null}

      {/* ====================================================== THE VOICE === */}
      <div className="pointer-events-none relative flex min-h-[100svh] flex-col items-center justify-end px-7 pb-[14vh]">
        <AnimatePresence mode="wait">
          {current ? (
            <motion.p
              key={`${phase}-${line}`}
              initial={{ opacity: 0 }}
              animate={{
                opacity: 1,
                transition: { duration: LINE_IN / 1000, ease: "easeOut" },
              }}
              exit={{
                opacity: 0,
                transition: { duration: LINE_OUT / 1000, ease: "easeIn" },
              }}
              className="font-heading max-w-lg text-center text-2xl leading-snug text-balance text-[#f3efe4] sm:text-3xl"
              style={{ textShadow: "0 2px 30px rgba(0,0,0,0.9)" }}
            >
              {current.text}
            </motion.p>
          ) : null}

          {/* What the room has to say for itself. */}
          {phase === "looking" && found ? (
            <motion.p
              key={found}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.5 } }}
              exit={{ opacity: 0, transition: { duration: 0.8 } }}
              className="max-w-sm text-center text-base text-[#e9e6da]/45 italic"
            >
              {found}
            </motion.p>
          ) : null}
        </AnimatePresence>

        {exit ? (
          <motion.a
            href="/labs/october/sketchbook"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 2.6, ease: "easeInOut" }}
            className="pointer-events-auto absolute bottom-10 text-sm text-[#e9e6da]/30 underline-offset-8 transition-colors hover:text-[#e9e6da]/60 hover:underline"
          >
            Step through.
          </motion.a>
        ) : null}
      </div>
    </main>
  );
}
