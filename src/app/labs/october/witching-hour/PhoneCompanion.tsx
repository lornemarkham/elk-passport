"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { createSound, pulse, type Sound } from "./audio";
import { joinPairing, type Cue, type Pairing } from "./pairing";
import { ACT_IV } from "./script";
import { keepAwake, type WakeLockHandle } from "./wakeLock";

/**
 * **The phone as a prop.**
 *
 * This screen is designed to be put down. Its whole job is to go dark, wait,
 * and then ask — once — to be picked up. What it says when it is picked up is
 * decided by the desktop; what it *notices* it reports back, and that report
 * is what lets the desktop change the world while nobody is watching it.
 *
 * ## What is and is not real
 *
 * Vibration is real on Android and does not exist on iOS Safari. So every wake
 * is a low thump through the headphones *and* a vibration where the platform
 * has one; the phone never claims a capability it lacks. Face-down detection
 * uses the orientation sensor where the person grants it (iOS asks), and falls
 * back to their own word otherwise.
 *
 * Nothing here records, tracks, or persists. When the channel closes, the
 * phone remembers nothing.
 */
type State =
  "connecting" | "connected" | "ready-ask" | "dark" | "woken" | "released";

export function PhoneCompanion({ code }: { code: string }) {
  const reduced = useReducedMotion() ?? false;
  const [state, setState] = useState<State>("connecting");
  const [line, setLine] = useState<string | null>(null);
  const [orientationOk, setOrientationOk] = useState<boolean | null>(null);
  const [awake, setAwake] = useState<boolean | null>(null);
  const wake = useRef<WakeLockHandle | null>(null);

  const sound = useRef<Sound | null>(null);
  const pairing = useRef<Pairing | null>(null);
  const faceDown = useRef(false);
  const reportedDown = useRef(false);
  const awaitingPickup = useRef(false);

  const report = useCallback((cue: Cue) => pairing.current?.send(cue), []);

  // Orientation: beta ≈ ±180 means the screen is facing the table.
  useEffect(() => {
    if (state !== "dark" && state !== "woken") return;

    function onOrientation(e: DeviceOrientationEvent) {
      const beta = e.beta ?? 0;
      const down = Math.abs(beta) > 150;
      if (down && !faceDown.current) {
        faceDown.current = true;
        if (!reportedDown.current) {
          reportedDown.current = true;
          report({ type: "phone-face-down" });
        }
      } else if (!down && faceDown.current) {
        faceDown.current = false;
        if (awaitingPickup.current) {
          awaitingPickup.current = false;
          report({ type: "phone-picked-up" });
        }
      }
    }

    window.addEventListener("deviceorientation", onOrientation);
    return () => window.removeEventListener("deviceorientation", onOrientation);
  }, [state, report]);

  useEffect(() => {
    sound.current = createSound();

    pairing.current = joinPairing(code, (cue: Cue) => {
      if (cue.type === "face-down") {
        setState("ready-ask");
        setLine(ACT_IV.paired.faceDown);
      }
      if (cue.type === "wake") {
        // The one physical moment. Then wait to be noticed.
        awaitingPickup.current = true;
        pulse();
        sound.current?.thump();
        setState("woken");
        setLine(cue.line);
      }
      if (cue.type === "release") {
        setState("released");
        setLine(ACT_IV.paired.releaseLine);
      }
    });

    // Announce, after a beat so the desktop's subscription has settled.
    const t = setTimeout(() => {
      report({ type: "phone-joined" });
      setState("connected");
    }, 900);

    return () => {
      clearTimeout(t);
      pairing.current?.close();
      sound.current?.close();
      wake.current?.release();
    };
  }, [code, report]);

  /**
   * "I'm ready": the gesture that unlocks audio, and — on iOS — the only
   * moment the orientation sensor can be asked for. If they say no, or the
   * API does not exist, their tap is taken as the phone being down, and any
   * later touch as it being picked up.
   */
  const ready = useCallback(async () => {
    await sound.current?.unlock();

    // Same gesture, second request: the screen must not lock while the phone
    // is face down waiting to be needed.
    wake.current = await keepAwake();
    setAwake(wake.current.supported);

    const DOE = (
      window as unknown as {
        DeviceOrientationEvent?: {
          requestPermission?: () => Promise<"granted" | "denied">;
        };
      }
    ).DeviceOrientationEvent;

    let granted = false;
    if (DOE?.requestPermission) {
      try {
        granted = (await DOE.requestPermission()) === "granted";
      } catch {
        granted = false;
      }
    } else {
      granted = typeof window.DeviceOrientationEvent !== "undefined";
    }
    setOrientationOk(granted);

    setState("dark");
    setLine(null);

    if (!granted) {
      // Their word is the sensor.
      reportedDown.current = true;
      report({ type: "phone-face-down" });
    }
  }, [report]);

  /** A touch while woken, without a sensor, is a pickup. */
  const touched = useCallback(() => {
    if (awaitingPickup.current && !orientationOk) {
      awaitingPickup.current = false;
      report({ type: "phone-picked-up" });
    }
  }, [orientationOk, report]);

  const dark = state === "dark";

  return (
    <div
      onPointerDown={touched}
      className="fixed inset-0 flex items-center justify-center overflow-hidden bg-[#020305] px-8 text-[#e9e6da] select-none"
      style={{ transition: "background-color 1600ms ease" }}
    >
      <AnimatePresence mode="wait">
        {state === "connecting" && (
          <motion.p
            key="c"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            className="font-mono text-xs tracking-[0.3em] uppercase"
          >
            joining
          </motion.p>
        )}

        {state === "connected" && (
          <motion.p
            key="ok"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.7 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2 }}
            className="font-serif text-2xl"
          >
            {ACT_IV.paired.connected}
          </motion.p>
        )}

        {state === "ready-ask" && (
          <motion.div
            key="ask"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2 }}
            className="flex flex-col items-center gap-10 text-center"
          >
            <p className="font-serif text-[1.6rem] leading-snug text-balance">
              {line}
            </p>
            <button
              type="button"
              onClick={() => void ready()}
              className="min-h-12 rounded-full border border-[#e9e6da]/40 px-8 font-serif text-lg"
            >
              ready
            </button>
          </motion.div>
        )}

        {(state === "woken" || state === "released") && line && (
          <motion.p
            key={line}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: reduced ? 0.2 : 1.4,
              delay: state === "woken" ? 0.9 : 0,
            }}
            className="max-w-xs text-center font-serif text-[1.6rem] leading-snug text-balance"
          >
            {line}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Dark: genuinely nothing. Not a dimmed UI — the absence of one. */}
      {dark && <div aria-hidden className="absolute inset-0 bg-black" />}

      <p className="absolute bottom-5 font-mono text-[10px] tracking-[0.25em] text-[#e9e6da]/25 uppercase">
        {code}
        {orientationOk === false && " · tap when you pick it up"}
        {awake === false && " · keep the screen from locking"}
      </p>
    </div>
  );
}
