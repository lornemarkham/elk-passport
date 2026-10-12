"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  checkCode,
  clamp,
  receive,
  verdictFor,
  type Station,
  type Wheels,
} from "@/domain/october/room";
import { getPassage, rememberPassage } from "@/domain/october/passage";
import { usePassage } from "@/components/october/passage/usePassage";
import { BOARD, RoomScene, SPOTS } from "./RoomScene";
import { Tuner } from "./Tuner";
import { Lock } from "./Lock";
import {
  armRoomAudio,
  felt,
  play,
  roomMuted,
  setPressure,
  setRoomMuted,
  stopRoomAudio,
  tuneRadio,
} from "./roomAudio";
import {
  ENTER_AGAIN,
  ENTER_FIRST,
  FLICKER_AT_MS,
  FLICKER_LINE,
  LINE_GAP,
  LINE_IN,
  LINE_OUT,
  NUDGE_RADIO,
  OPENED,
  RADIO_NUDGE_MS,
  SLIP,
  SLIP_AFTER_MS,
  TAPE_AFTER,
  TAPE_PLAYS,
  THINGS,
  type Line,
} from "./roomScript";

/**
 * **The Secret Room.** One room, one door, three wheels and a radio.
 *
 * The room is the same picture the whole way through — it is never swapped
 * for a puzzle screen. The radio and the lock come up *under* it, so the
 * window, the clock and the wall stay in view while you are being asked about
 * them, which is the entire puzzle.
 *
 * ## Where the rules live
 *
 * What the room decides — the code, the stations, what October says to a wrong
 * guess — is in `domain/october/room.ts` and tested there. This file is what it
 * looks and sounds like, and *when October speaks*: it helps when you have
 * been stuck, and interferes when you are comfortable, and both are timers
 * here because that is what they are.
 *
 * ## What it shares with the store
 *
 * `usePassage()` — the tape. A person who took the unlabeled tape off the
 * bottom shelf can play it here, once the door is open. Nobody is ever
 * required to; it is an ending, not a key.
 */

type Panel = "none" | "radio" | "lock";
type Stage = "cover" | "room" | "open" | "tape";
type SpotId = keyof typeof SPOTS;

const pct = (n: number, of: number) => `${(n / of) * 100}%`;

export function SecretRoom() {
  const reduced = useReducedMotion() ?? false;
  const passage = usePassage();

  const [stage, setStage] = useState<Stage>("cover");
  const [panel, setPanel] = useState<Panel>("none");
  const [line, setLine] = useState<string | null>(null);
  const [frequency, setFrequency] = useState(92);
  const [heard, setHeard] = useState<readonly Station[]>([]);
  const [wheels, setWheels] = useState<Wheels>([0, 0, 0]);
  const [wrong, setWrong] = useState(0);
  const [caught, setCaught] = useState<
    readonly [boolean, boolean, boolean] | null
  >(null);
  const [shaking, setShaking] = useState(false);
  const [dark, setDark] = useState(false);
  const [radioGlow, setRadioGlow] = useState(false);
  const [exitReady, setExitReady] = useState(false);
  const [muted, setMuted] = useState(false);
  const [tapeCut, setTapeCut] = useState(false);

  /** Things the room does on its own clock: October's interference, the bell. */
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  /** The line being spoken. A new line replaces it rather than racing it. */
  const voice = useRef<ReturnType<typeof setTimeout>[]>([]);
  const speaking = useRef(false);
  const touched = useRef(0);
  const radioOpened = useRef(false);
  const flickered = useRef(false);
  const slipped = useRef(false);
  const stageEl = useRef<HTMLDivElement>(null);
  const beam = useRef({ x: 50, y: 52, free: true });

  const after = useCallback((ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);

  useEffect(() => {
    const running = timers.current;
    const speech = voice.current;
    return () => {
      for (const t of running) clearTimeout(t);
      for (const t of speech) clearTimeout(t);
      stopRoomAudio();
    };
  }, []);

  // ----------------------------------------------------------- the voice
  /**
   * October speaking. A sequence holds the floor: while it runs, the things in
   * the room are quiet, so a long beat is never talked over by a clock.
   */
  const say = useCallback(
    (lines: readonly Line[], opts?: { hold?: boolean; then?: () => void }) => {
      if (speaking.current && !opts?.hold) return;
      // A new line replaces the one being spoken: otherwise the old line's
      // clear-timer wipes the new one a moment after it appears.
      for (const t of voice.current) clearTimeout(t);
      voice.current = [];
      // A sequence that holds the floor also ends what the room was about to
      // do on its own: it is past the moment those timers were for.
      if (opts?.hold) {
        for (const t of timers.current) clearTimeout(t);
        timers.current = [];
        speaking.current = true;
      }
      const speak = (ms: number, fn: () => void) =>
        voice.current.push(setTimeout(fn, ms));
      let t = 0;
      lines.forEach((l) => {
        speak(t, () => setLine(l.text));
        t += LINE_IN + l.hold;
        speak(t, () => setLine(null));
        t += LINE_OUT + LINE_GAP;
      });
      speak(t, () => {
        if (opts?.hold) speaking.current = false;
        opts?.then?.();
      });
    },
    [],
  );

  const remark = useCallback(
    (text: string, hold = 2600) => say([{ text, hold }]),
    [say],
  );

  // ------------------------------------------------------------ the beam
  const paintBeam = useCallback((x: number, y: number) => {
    const el = stageEl.current;
    if (!el) return;
    beam.current.x = x;
    beam.current.y = y;
    el.style.setProperty("--lx", `${x}%`);
    el.style.setProperty("--ly", `${y}%`);
  }, []);

  const aimFrom = useCallback(
    (e: React.PointerEvent) => {
      const el = stageEl.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      beam.current.free = true;
      paintBeam(
        ((e.clientX - r.left) / r.width) * 100,
        ((e.clientY - r.top) / r.height) * 100,
      );
    },
    [paintBeam],
  );

  /** October carries the light somewhere, unasked. Help, or a nudge. */
  const carryBeam = useCallback(
    (x: number, y: number, ms: number) => {
      if (reduced) {
        paintBeam(x, y);
        return;
      }
      beam.current.free = false;
      const from = { x: beam.current.x, y: beam.current.y };
      const start = performance.now();
      const step = (now: number) => {
        if (beam.current.free) return;
        const k = Math.min(1, (now - start) / ms);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        paintBeam(from.x + (x - from.x) * e, from.y + (y - from.y) * e);
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    },
    [paintBeam, reduced],
  );

  useEffect(() => {
    paintBeam(50, 52);
  }, [paintBeam]);

  // ----------------------------------------------------------- the cover
  const enter = useCallback(() => {
    if (stage !== "cover") return;
    armRoomAudio();
    // Skipping the doorway skips what it was saying, and its hold on the floor.
    for (const t of voice.current) clearTimeout(t);
    voice.current = [];
    speaking.current = false;
    setLine(null);
    setStage("room");
  }, [stage]);

  useEffect(() => {
    if (stage !== "cover") return;
    // Read directly: the hook's first snapshot is the server's empty one.
    const lines = getPassage().escaped ? ENTER_AGAIN : ENTER_FIRST;
    // The cover is a doorway you walk through, and it is quick: it says its
    // one line and lets go.
    say(lines, {
      hold: true,
      then: () => setStage((s) => (s === "cover" ? "room" : s)),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----------------------------------------------------- October interferes
  useEffect(() => {
    if (stage !== "room") return;
    // Nobody has touched anything: say so, kindly.
    after(14_000, () => {
      if (touched.current === 0) remark("Go on. Touch something.");
    });
    // Nobody has found the radio: take the light there.
    after(RADIO_NUDGE_MS, () => {
      if (radioOpened.current) return;
      setRadioGlow(true);
      carryBeam(17, 64, 1800);
      say(NUDGE_RADIO);
    });
    // The light goes out, once, while you are comfortable.
    after(FLICKER_AT_MS, () => {
      if (flickered.current || reduced) return;
      flickered.current = true;
      play("flicker");
      setDark(true);
      after(180, () => setDark(false));
      after(320, () => {
        setDark(true);
        play("flicker");
      });
      after(900, () => setDark(false));
      say(FLICKER_LINE);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // ----------------------------------------------------------- the radio
  const reception = useMemo(() => receive(frequency), [frequency]);

  useEffect(() => {
    const on = panel === "radio";
    tuneRadio({
      on,
      dial: (frequency - 88) / 20,
      static: reception.static,
      clarity: reception.clarity,
      liar: reception.station?.id === "october",
    });
  }, [panel, frequency, reception]);

  // A station heard clearly is a station heard.
  useEffect(() => {
    if (panel !== "radio" || reception.clarity < 1 || !reception.station)
      return;
    const s = reception.station;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHeard((h) => (h.some((x) => x.id === s.id) ? h : [...h, s]));
    play("tick", 1.6);
  }, [panel, reception]);

  // October takes the dial away from the middle station, once.
  useEffect(() => {
    if (panel !== "radio" || slipped.current) return;
    if (reception.clarity < 1 || reception.station?.id !== "hour") return;
    const t = setTimeout(() => {
      slipped.current = true;
      play("static");
      setFrequency((f) => clamp(f + 1.9));
      say(SLIP);
    }, SLIP_AFTER_MS);
    return () => clearTimeout(t);
  }, [panel, reception, say]);

  useEffect(() => {
    const got = heard.filter((s) => s.wheel !== null).length;
    setPressure(got / 3 + (wrong > 0 ? 0.2 : 0));
  }, [heard, wrong]);

  // ------------------------------------------------------------- the lock
  const spin = useCallback((wheel: 0 | 1 | 2, by: 1 | -1) => {
    setWheels((w) => {
      const next = [...w] as [number, number, number];
      next[wheel] = (next[wheel] + by + 10) % 10;
      return next;
    });
    play("tick");
    felt(8);
  }, []);

  const solve = useCallback(() => {
    rememberPassage("escaped");
    setPanel("none");
    setStage("open");
    setCaught(null);
    play("creak");
    carryBeam(50, 70, 1400);
    say(OPENED, { hold: true });
    after(900, () => play("bell", 0.75));
    // Nobody has to wait for October to finish talking to leave.
    after(3200, () => setExitReady(true));
  }, [after, carryBeam, say]);

  const tryCode = useCallback(() => {
    const result = checkCode(wheels);
    if (result.open) {
      solve();
      return;
    }
    const verdict = verdictFor(wheels, wrong);
    setWrong((n) => n + 1);
    play("thud");
    felt([30, 40, 30]);
    setShaking(true);
    after(420, () => setShaking(false));
    if (verdict.reveal) {
      setCaught(result.right);
      play("latch");
    }
    remark(verdict.line, 3000);
  }, [wheels, wrong, solve, after, remark]);

  // ---------------------------------------------------------- the things
  const inspect = useCallback(
    (id: SpotId) => {
      touched.current += 1;
      play("tick", 0.7);

      if (id === "radio") {
        radioOpened.current = true;
        setRadioGlow(false);
        setPanel((p) => (p === "radio" ? "none" : "radio"));
        if (!heard.length) remark(THINGS.radio, 3200);
        return;
      }
      if (id === "door") {
        if (stage === "open") {
          if (exitReady) window.location.assign("/october/store");
          return;
        }
        setPanel((p) => (p === "lock" ? "none" : "lock"));
        return;
      }
      if (id === "vcr" || id === "tv") {
        if (stage === "open" && passage.tape && !tapeCut) {
          setStage("tape");
          play("static");
          return;
        }
        remark(
          id === "tv"
            ? THINGS.tv
            : passage.tape
              ? THINGS.vcrTape
              : THINGS.vcrEmpty,
        );
        return;
      }
      if (id === "wall") {
        remark(THINGS.wall);
        return;
      }
      remark(THINGS[id as keyof typeof THINGS] ?? "");
    },
    [stage, exitReady, passage.tape, tapeCut, heard.length, remark],
  );

  const onSpot = useCallback(
    (e: React.MouseEvent<HTMLElement>) =>
      inspect(e.currentTarget.dataset.spot as SpotId),
    [inspect],
  );

  // ------------------------------------------------------------ the tape
  useEffect(() => {
    if (stage !== "tape") return;
    // The recording: what October kept, and then what it says about it.
    say(TAPE_PLAYS, {
      hold: true,
      then: () => {
        setTapeCut(true);
        play("static");
        after(1100, () =>
          say(TAPE_AFTER, {
            hold: true,
            then: () => {
              rememberPassage("played");
              setStage("open");
              setExitReady(true);
            },
          }),
        );
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage === "tape"]);

  // ---------------------------------------------------------------- render
  const open = stage === "open" || stage === "tape";
  const tvGlow = open && !!passage.tape && !passage.played && !tapeCut;
  const showTape = stage === "tape";
  const spots = (Object.keys(SPOTS) as SpotId[]).filter((id) => id !== "floor");
  const labels: Record<SpotId, string> = {
    window: "The window",
    clock: "The clock",
    wall: "The wall",
    door: open ? "The open door" : "The door",
    radio: "The radio",
    tv: "The television",
    vcr: "The video recorder",
    floor: "The floor",
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center overflow-hidden bg-[#050407] text-[#e9e6da] select-none lg:flex-row lg:gap-12 [@media(max-height:560px)]:flex-row"
      onPointerDown={() => armRoomAudio()}
      data-testid="secret-room"
      data-stage={stage}
      data-open={open ? "true" : "false"}
    >
      <style>{`
        @keyframes room-seam { from { opacity:.25 } to { opacity:.7 } }
        @keyframes room-pulse { 0%,100% { opacity:.25 } 50% { opacity:1 } }
        @keyframes room-blink { 0%,60% { opacity:1 } 61%,100% { opacity:.15 } }
        @keyframes room-shake { 0%,100% { transform:translateX(0) } 25% { transform:translateX(-6px) } 75% { transform:translateX(6px) } }
        @keyframes room-open { from { transform: scaleX(.04) } to { transform: scaleX(1) } }
        @keyframes room-static { 0% { transform: translate(0,0) } 25% { transform: translate(-3%,2%) } 50% { transform: translate(2%,-3%) } 75% { transform: translate(-2%,-1%) } 100% { transform: translate(0,0) } }
        .room-seam { animation: room-seam 4s ease-in-out infinite alternate }
        .room-pulse { animation: room-pulse 2.2s ease-in-out infinite }
        .room-blink { animation: room-blink 1.4s steps(1) infinite }
        .room-shake { animation: room-shake .4s ease-in-out }
        .room-door-open { transform-box: fill-box; transform-origin: left center; animation: room-open 2.4s ease-in-out forwards }
        .room-static { animation: room-static .25s steps(4) infinite }
        .room-dial { appearance:none; background:transparent }
        .room-dial::-webkit-slider-runnable-track { height:4px; border-radius:2px; background:linear-gradient(90deg,#4a3a2c,#d8b977 50%,#4a3a2c) }
        .room-dial::-moz-range-track { height:4px; border-radius:2px; background:linear-gradient(90deg,#4a3a2c,#d8b977 50%,#4a3a2c) }
        .room-dial::-webkit-slider-thumb { appearance:none; width:14px; height:34px; margin-top:-15px; border-radius:2px; background:#b3492f; border:1px solid #f3d0b0 }
        .room-dial::-moz-range-thumb { width:12px; height:32px; border-radius:2px; background:#b3492f; border:1px solid #f3d0b0 }
        .room-dial:focus-visible { outline: 2px solid #ffcf8a; outline-offset: 4px }
        @media (prefers-reduced-motion: reduce) { .room-seam,.room-pulse,.room-blink,.room-static { animation:none } }
      `}</style>

      {/* ------------------------------------------------------- the room */}
      <div
        ref={stageEl}
        onPointerMove={aimFrom}
        onPointerDown={aimFrom}
        className="relative h-[var(--stage-h)] shrink-0 overflow-hidden [--stage-h:min(calc(100svh_-_17rem),130vw)] lg:[--stage-h:calc(100svh_-_2rem)] [@media(max-height:560px)]:[--stage-h:calc(100svh_-_1rem)]"
        data-testid="room-stage"
        style={{
          aspectRatio: `${BOARD.width} / ${BOARD.height}`,
          touchAction: "none",
        }}
      >
        <RoomScene
          open={open}
          radioGlow={radioGlow}
          tvOn={showTape}
          tvGlow={tvGlow}
        />

        {/* The light. Everything is dim; the beam is where you are looking. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 transition-opacity duration-[2400ms]"
          style={{
            opacity: open ? 0.12 : 1,
            background:
              "radial-gradient(circle at var(--lx, 50%) var(--ly, 50%), rgba(5,4,7,0) 0%, rgba(5,4,7,0.02) 10%, rgba(5,4,7,0.64) 40%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-black"
          style={{
            opacity: dark ? 1 : 0,
            transition: dark ? "none" : "opacity 400ms",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 90% at 50% 45%, transparent 35%, rgba(0,0,0,0.7) 100%)",
          }}
        />

        {/* Things you can touch. Buttons, because they are. */}
        {stage !== "cover" &&
          spots.map((id) => {
            const s = SPOTS[id];
            return (
              <button
                key={id}
                type="button"
                aria-label={labels[id]}
                data-testid={`spot-${id}`}
                data-spot={id}
                onClick={onSpot}
                className="absolute cursor-pointer rounded-sm outline-none focus-visible:shadow-[inset_0_0_0_2px_rgba(255,214,150,0.6)]"
                style={{
                  left: pct(s.x, BOARD.width),
                  top: pct(s.y, BOARD.height),
                  width: pct(s.w, BOARD.width),
                  height: pct(s.h, BOARD.height),
                }}
              />
            );
          })}

        {/* The tape: the room as the television remembers it. */}
        <AnimatePresence>
          {showTape ? (
            <motion.div
              key="tape"
              data-testid="tape-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
              className="absolute inset-0 overflow-hidden bg-black"
            >
              <div
                className="absolute inset-0"
                style={{
                  filter:
                    "grayscale(1) contrast(1.35) brightness(1.25) blur(0.5px)",
                }}
              >
                <RoomScene
                  open={false}
                  radioGlow={false}
                  tvOn={false}
                  tvGlow={false}
                />
                {/* Somebody sitting on the floor, facing the door. */}
                {!tapeCut ? (
                  <svg
                    viewBox={`0 0 ${BOARD.width} ${BOARD.height}`}
                    preserveAspectRatio="none"
                    className="absolute inset-0 h-full w-full"
                    aria-hidden
                  >
                    <ellipse
                      cx="50"
                      cy="121"
                      rx="12"
                      ry="2.6"
                      fill="#000"
                      opacity="0.6"
                    />
                    <path
                      d="M 41 121 Q 42 105 50 105 Q 58 105 59 121 Z"
                      fill="#26262b"
                      stroke="#6a6a72"
                      strokeWidth="0.5"
                    />
                    <circle
                      cx="50"
                      cy="100.5"
                      r="4.4"
                      fill="#26262b"
                      stroke="#6a6a72"
                      strokeWidth="0.5"
                    />
                  </svg>
                ) : null}
              </div>
              <div
                aria-hidden
                className="room-static absolute -inset-4 opacity-[0.22] mix-blend-screen"
                style={{
                  backgroundImage:
                    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E\")",
                  opacity: tapeCut ? 0.7 : 0.22,
                }}
              />
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  background:
                    "repeating-linear-gradient(0deg, rgba(0,0,0,0.28) 0 1px, transparent 1px 3px)",
                }}
              />
              <p className="absolute top-3 left-3 font-mono text-[10px] tracking-widest text-[#e9e6da]/70">
                ▶ PLAY &nbsp; SP
              </p>
              <p className="absolute right-3 bottom-3 font-mono text-[10px] tracking-widest text-[#e9e6da]/60">
                OCT 31 &nbsp; 03:12
              </p>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Door out. */}
        {exitReady ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 2.4 }}
            className="absolute inset-x-0 bottom-[5%] flex justify-center"
          >
            <Link
              href="/october/store"
              data-testid="room-exit"
              onClick={() => stopRoomAudio()}
              className="min-h-11 rounded-full border border-[#ffcf8a]/40 bg-black/40 px-7 py-2.5 text-sm tracking-wide text-[#ffe2b0] backdrop-blur-sm transition-colors hover:bg-[#ffcf8a]/10"
            >
              Step through.
            </Link>
          </motion.div>
        ) : null}

        {/* The cover, before you are in. Tap to skip it. */}
        <AnimatePresence>
          {stage === "cover" ? (
            <motion.button
              key="cover"
              type="button"
              data-testid="room-cover"
              aria-label="Enter"
              onClick={enter}
              exit={{ opacity: 0, transition: { duration: 1.6 } }}
              className="absolute inset-0 z-10 cursor-pointer bg-[#050407]"
            />
          ) : null}
        </AnimatePresence>
      </div>

      {/* --------------------------------------------------- the console */}
      <div className="relative flex min-h-[17rem] w-full max-w-md flex-1 flex-col items-center justify-start overflow-y-auto px-6 pt-3 lg:h-[calc(100svh_-_2rem)] lg:min-h-0 lg:w-[22rem] lg:flex-none lg:justify-center lg:pt-0 [@media(max-height:560px)]:min-h-0 [@media(max-height:560px)]:justify-center">
        <div className="flex min-h-[3.6rem] w-full items-center justify-center">
          <AnimatePresence mode="wait">
            {line ? (
              <motion.p
                key={line}
                data-testid="room-voice"
                aria-live="polite"
                initial={{ opacity: 0 }}
                animate={{
                  opacity: 1,
                  transition: { duration: LINE_IN / 1000 },
                }}
                exit={{
                  opacity: 0,
                  transition: { duration: LINE_OUT / 1000 },
                }}
                className="font-heading max-w-md text-center text-xl leading-snug text-balance text-[#f3efe4] sm:text-2xl"
                style={{ textShadow: "0 2px 24px rgba(0,0,0,0.9)" }}
              >
                {line}
              </motion.p>
            ) : null}
          </AnimatePresence>
        </div>

        <div className="mt-1 flex w-full flex-1 items-start justify-center">
          {panel === "radio" ? (
            <Tuner
              frequency={frequency}
              onChange={setFrequency}
              reception={reception}
              heard={heard}
              onClose={() => setPanel("none")}
            />
          ) : panel === "lock" ? (
            <Lock
              wheels={wheels}
              caught={caught as [boolean, boolean, boolean] | null}
              shaking={shaking}
              onSpin={spin}
              onTry={tryCode}
              onClose={() => setPanel("none")}
            />
          ) : null}
        </div>
      </div>

      {/* Chrome, as quiet as the store's. */}
      <Link
        href="/october/from"
        onClick={() => stopRoomAudio()}
        data-testid="room-leave"
        className="absolute top-3 left-4 z-20 flex min-h-11 items-center text-[11px] tracking-wide text-[#e9e6da]/30 underline-offset-4 transition-colors hover:text-[#e9e6da]/70 hover:underline"
      >
        back to October
      </Link>
      <button
        type="button"
        aria-label={muted ? "Sound on" : "Sound off"}
        aria-pressed={muted}
        data-testid="room-sound"
        onClick={() => {
          const next = !roomMuted();
          armRoomAudio();
          setRoomMuted(next);
          setMuted(next);
        }}
        className="absolute top-3 right-4 z-20 flex min-h-11 min-w-11 items-center justify-center text-[11px] tracking-wide text-[#e9e6da]/30 transition-colors hover:text-[#e9e6da]/70"
      >
        {muted ? "sound off" : "sound on"}
      </button>
    </div>
  );
}
