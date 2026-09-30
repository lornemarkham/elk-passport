"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import QRCode from "qrcode";
import { NightSky, OPENING_WORLD, type World } from "./NightSky";
import { createSound, pulse, type Sound } from "./audio";
import { joinPairing, newCode, type Cue, type Pairing } from "./pairing";
import { useTimeline } from "./useTimeline";
import {
  ACT_I,
  ACT_II,
  ACT_III,
  ACT_IV,
  ACT_V,
  BEAT,
  CONTEXT,
  DOOR,
} from "./script";
import { StayInside } from "./StayInside";

/**
 * **Witching Hour, v0.**
 *
 * One night, three ways to be in it: a phone in a hand, a desktop alone, or a
 * desktop that has borrowed the phone as a prop. Same world, same words; what
 * differs is what the scene can *touch*.
 *
 * Nothing here is an engine. It is a shot list with a state machine wrapped
 * around it, and it should stay that way until a second scene exists to argue
 * with it.
 */

type Phase =
  | "arrive"
  | "act1"
  | "headphones"
  | "teach"
  | "violate"
  | "phone-alone"
  | "pair-offer"
  | "pair-wait"
  | "paired"
  | "desktop-alone"
  | "doorway"
  | "chosen"
  | "door"
  | "inside";

type Device = "phone" | "desktop";

/**
 * A media query as an external store: no effect, no setState-after-mount, and
 * the server snapshot is a fixed answer so hydration never disagrees with
 * itself. The first client frame corrects it before anything is visible.
 */
function useMedia(query: string, serverValue = false): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

export function WitchingHour() {
  const reduced = useReducedMotion() ?? false;
  const tl = useTimeline();
  const coarse = useMedia("(pointer: coarse)");
  const narrow = useMedia("(max-width: 899px)");
  const portrait = useMedia("(orientation: portrait)");
  const device: Device = coarse && narrow ? "phone" : "desktop";
  const [phase, setPhase] = useState<Phase>("arrive");
  const [line, setLine] = useState<string | null>(null);
  const [world, setWorld] = useState<World>(OPENING_WORLD);
  const [drift, setDrift] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [originReachable, setOriginReachable] = useState(true);
  // What the paired phone reported it can do. Shapes the cut, never the copy.
  const phoneAwake = useRef<boolean | null>(null);

  const sound = useRef<Sound | null>(null);
  const pairing = useRef<Pairing | null>(null);
  const phoneSignal = useRef<Record<string, () => void>>({});
  // The acts call each other out of declaration order (teach → phoneAlone,
  // paired → doorway). Routing those calls through one ref keeps each act a
  // plain callback without a forward-reference the compiler would refuse.
  const acts = useRef<Record<string, (...args: never[]) => void>>({});

  useEffect(() => {
    sound.current = createSound();
    return () => {
      sound.current?.close();
      pairing.current?.close();
    };
  }, []);

  // The camera. Slow enough to be noticed only in retrospect.
  useEffect(() => {
    if (reduced) return;
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      const t = (performance.now() - start) / 1000;
      setDrift(Math.min(1, t / 240));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  const say = useCallback(
    async (text: string | null, hold: number) => {
      setLine(text);
      await tl.wait(hold);
    },
    [tl],
  );

  // ------------------------------------------------------------ ACT I
  const beginNight = useCallback(async () => {
    setPhase("act1");
    await tl.wait(ACT_I.before);
    for (const l of ACT_I.lines) {
      await say(l.text, l.hold);
      setLine(null);
      await tl.wait(ACT_I.gap);
    }
    await tl.wait(ACT_I.silenceAfter);
    if (!tl.isAlive()) return;
    setPhase("headphones");
    setLine(ACT_II.ask);
  }, [say, tl]);

  // ------------------------------------------------------------ ACT II + III
  const teach = useCallback(
    async (withHeadphones: boolean) => {
      setPhase("teach");
      await sound.current?.unlock();
      sound.current?.wind(0.16, 6);
      await say(withHeadphones ? ACT_II.yes : ACT_II.no, BEAT);
      setLine(null);
      await tl.wait(ACT_II.settle);

      for (const lesson of ACT_II.lessons) {
        sound.current?.tick(lesson.side);
        await tl.wait(lesson.delay);
        if (lesson.effect === "light-on") {
          setWorld((w) => ({ ...w, lights: [true, w.lights[1], w.lights[2]] }));
        } else {
          setWorld((w) => ({ ...w, branchStir: true }));
          await tl.wait(1400);
          setWorld((w) => ({ ...w, branchStir: false }));
        }
        await tl.wait(ACT_II.betweenLessons);
      }

      // ACT III. The rule breaks, and nobody says so.
      setPhase("violate");
      sound.current?.tick(ACT_III.soundSide);
      await tl.wait(ACT_III.nothingFor);
      setWorld((w) => ({ ...w, lights: [false, w.lights[1], w.lights[2]] }));
      await tl.wait(ACT_III.settle);
      if (!tl.isAlive()) return;

      // ACT IV depends on what is in the room.
      if (device === "phone") {
        acts.current.phoneAlone?.();
      } else {
        setPhase("pair-offer");
        setLine(ACT_IV.paired.desktopAsk);
      }
    },
    [device, say, tl],
  );

  // ------------------------------------------------------------ ACT IV · phone alone
  const phoneAlone = useCallback(async () => {
    setPhase("phone-alone");
    await say(ACT_IV.phoneAlone.ask, ACT_IV.phoneAlone.beforePulse);
    setLine(null);
    await tl.wait(500);
    pulse();
    sound.current?.thump();
    await tl.wait(1100);
    await say(ACT_IV.phoneAlone.after, ACT_IV.phoneAlone.afterHold);
    await say(ACT_IV.phoneAlone.second, BEAT * 2);
    setLine(null);
    await tl.wait(BEAT);
    acts.current.doorway?.();
  }, [say, tl]);

  // ------------------------------------------------------------ ACT IV · desktop + phone
  const offerPairing = useCallback(async () => {
    const c = newCode();
    setCode(c);
    // The QR encodes wherever the desktop is loaded from. On a phone,
    // "localhost" is the phone, and a LAN address is only reachable on the
    // same network — so the scene says so rather than printing a code that
    // will 404 in somebody's hand.
    const origin = window.location.origin;
    setOriginReachable(
      !/localhost|127\.0\.0\.1|\.local\b|^https?:\/\/(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./i.test(
        origin,
      ),
    );
    const url = `${origin}/labs/october/witching-hour/join/${c}`;
    setQr(
      await QRCode.toDataURL(url, {
        margin: 1,
        width: 320,
        color: { dark: "#e9e6da", light: "#00000000" },
      }),
    );
    setPhase("pair-wait");
    setLine(ACT_IV.paired.scanHint);

    const joined = tl.waitFor(180_000);
    pairing.current = joinPairing(c, (cue: Cue) => {
      if (cue.type === "phone-joined") joined.signal();
      if (cue.type === "phone-ready") phoneAwake.current = cue.awake;
      if (cue.type === "phone-face-down") phoneSignal.current["face-down"]?.();
      if (cue.type === "phone-picked-up") phoneSignal.current["picked-up"]?.();
    });

    const ok = await joined.promise;
    if (!tl.isAlive()) return;
    if (!ok) {
      // Three minutes and no phone. The night does not stall on it.
      acts.current.desktopAlone?.();
      return;
    }
    acts.current.paired?.();
  }, [tl]);

  const paired = useCallback(async () => {
    setPhase("paired");
    setQr(null);
    await say(ACT_IV.paired.connected, BEAT);
    setLine(ACT_IV.paired.faceDown);
    pairing.current?.send({ type: "face-down" });

    // Interaction sets the pace from here. The line stays up until the phone
    // says it is down; a person who taps "ready" without flipping it is still
    // holding a dark phone, which is enough. Twenty seconds is the ceiling
    // so a phone left face-up on the desk does not stall the night.
    const down = tl.waitFor(20_000);
    phoneSignal.current["face-down"] = down.signal;
    await down.promise;
    if (!tl.isAlive()) return;

    // The phone leaves the room. This wait is October's, visibly: one line,
    // then the wind rises a little, then one tick on the left that leads
    // nowhere — a small promise that something is coming, which is what
    // separates mystery from a stalled program.
    //
    // Shorter still if the phone could not hold a wake lock (ADR 001: the
    // instrument in the room shapes the cut). No iPhone auto-locks inside
    // either window.
    const dormancy =
      phoneAwake.current === false ? 6000 : ACT_IV.paired.dormancy;
    await tl.wait(ACT_IV.paired.leaveItAfter);
    await say(ACT_IV.paired.leaveIt, BEAT * 1.4);
    setLine(null);
    sound.current?.wind(0.22, 4);
    await tl.wait(dormancy * 0.45);
    sound.current?.tick(-1);
    await tl.wait(dormancy * 0.55);
    if (!tl.isAlive()) return;

    // First wake. The phone thumps; the phone scolds them for answering.
    const up1 = tl.waitFor(30_000);
    phoneSignal.current["picked-up"] = up1.signal;
    pairing.current?.send({ type: "wake", line: ACT_IV.paired.wakeLine });
    const picked1 = await up1.promise;
    if (!tl.isAlive()) return;

    if (picked1) {
      // They are reading the phone. The world changes now, without motion:
      // the left tree goes, and the whole sky drops — a change the eye
      // registers before it looks. Then one small sound from the desktop, the
      // hook that brings the eyes back. Nothing is explained.
      await tl.wait(ACT_IV.paired.attentionWindow);
      setWorld((w) => ({ ...w, leftTree: false, dim: true }));
      await tl.wait(ACT_IV.paired.hookAfter);
      sound.current?.tick(-1);
    }

    // Put it back. Conditioned now: they look down faster.
    await tl.wait(2600);
    await say(ACT_IV.paired.putItBack, BEAT * 1.2);
    setLine(null);
    await tl.wait(ACT_IV.paired.secondDormancy);
    if (!tl.isAlive()) return;

    const up2 = tl.waitFor(30_000);
    phoneSignal.current["picked-up"] = up2.signal;
    pairing.current?.send({ type: "wake", line: ACT_IV.paired.secondWakeLine });
    const picked2 = await up2.promise;
    if (!tl.isAlive()) return;

    if (picked2) {
      // Second violation, opposite in kind: the lights are gone and the moon
      // is clear — the sky brighter and emptier, not darker. A different
      // wrongness, so the second look is not a repeat of the first.
      await tl.wait(ACT_IV.paired.attentionWindow);
      setWorld((w) => ({
        ...w,
        lights: [false, false, false],
        moonClear: true,
        dim: false,
      }));
      await tl.wait(ACT_IV.paired.hookAfter);
      sound.current?.tick(1);
    }

    await tl.wait(2200);
    pairing.current?.send({ type: "release", line: ACT_IV.paired.releaseLine });
    await tl.wait(ACT_IV.paired.afterRelease);
    acts.current.doorway?.();
  }, [say, tl]);

  // ------------------------------------------------------------ ACT IV · desktop alone
  const desktopAlone = useCallback(async () => {
    setPhase("desktop-alone");
    setQr(null);
    pairing.current?.close();
    pairing.current = null;
    // The desktop's physical beat is sound. One thump, then the last light.
    await say("That's alright.", BEAT * 1.4);
    setLine(null);
    sound.current?.wind(0.22, 4);
    await tl.wait(BEAT * 2);
    sound.current?.thump();
    await tl.wait(1800);
    setWorld((w) => ({ ...w, lights: [false, false, w.lights[2]], dim: true }));
    await tl.wait(BEAT * 2.5);
    acts.current.doorway?.();
  }, [say, tl]);

  // ------------------------------------------------------------ ACT V
  const doorway = useCallback(async () => {
    setPhase("doorway");
    sound.current?.wind(0.06, 8);
    await say(ACT_V.ask, BEAT * 1.6);
    await say(ACT_V.then, BEAT);
    // Line stays; the choices arrive under it.
  }, [say]);

  const choose = useCallback(
    async (id: string) => {
      setChosen(id);
      setPhase("chosen");
      const reply =
        id === "escape"
          ? ACT_V.escape.reply
          : (ACT_V.choices.find((c) => c.id === id)?.reply ?? "");
      if (device === "phone" && id !== "escape") {
        pulse();
        sound.current?.thump();
        await tl.wait(500);
      }
      setLine(reply);

      if (id !== "inside") {
        sound.current?.wind(0, 8);
        return;
      }

      // -------------------------------------------------------- THE DOOR
      // "The door stays closed tonight." Then it does what the line promised.
      await tl.wait(DOOR.replyHold);
      setLine(null);
      await tl.wait(DOOR.beforeLatch);
      sound.current?.latch();
      await tl.wait(DOOR.latchToSlam);
      if (!tl.isAlive()) return;

      setPhase("door");
      sound.current?.slam();
      // The phone is another wall in the same room: it takes the hit a
      // breath later, so the door is somewhere between the two.
      setTimeout(() => pairing.current?.send({ type: "door" }), 140);
      if (device === "phone") pulse();

      await tl.wait(DOOR.silenceAfter);
      await say(DOOR.locked, DOOR.lockedHold);
      setLine(null);
      await tl.wait(DOOR.beforeSurface);
      if (!tl.isAlive()) return;

      // Hand back to Passport. The wind returns, low: the night is still
      // there, behind the surface.
      sound.current?.wind(0.08, 6);
      setPhase("inside");
    },
    [device, say, tl],
  );

  // Registered in an effect, not during render — a ref written during render
  // is the one thing the compiler will not let stand.
  useEffect(() => {
    acts.current.phoneAlone = phoneAlone;
    acts.current.desktopAlone = desktopAlone;
    acts.current.paired = paired;
    acts.current.doorway = doorway;
  }, [phoneAlone, desktopAlone, paired, doorway]);

  const context = useMemo(
    () =>
      `${CONTEXT.date} · ${CONTEXT.temperature} · ${CONTEXT.sky} · moon ${CONTEXT.moon}`,
    [],
  );

  // ------------------------------------------------------------ render
  return (
    <div className="fixed inset-0 overflow-hidden bg-[#030408] text-[#e9e6da] select-none">
      <NightSky
        world={world}
        motion={!reduced}
        drift={drift}
        portrait={portrait}
      />

      {/* Vignette. The edges of the frame are darker than the middle, always. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 45%, transparent 40%, rgba(2,3,6,0.55) 100%)",
        }}
      />

      {/* Fixture readout: small, top-left, present the whole time. */}
      <p className="absolute top-5 left-5 font-mono text-[10px] tracking-[0.18em] text-[#e9e6da]/35 uppercase">
        {context} · {CONTEXT.fear}
      </p>

      {/* The line. One at a time, centred, unhurried — and it rises to make
          room when the night finally asks something of you. */}
      <div
        className={`absolute inset-0 flex justify-center px-8 transition-[padding] duration-[2400ms] ease-[cubic-bezier(.22,.61,.36,1)] ${
          phase === "doorway" ? "items-start pt-[14vh]" : "items-center"
        }`}
      >
        <AnimatePresence mode="wait">
          {line && (
            <motion.p
              key={line}
              initial={{ opacity: 0, y: reduced ? 0 : 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduced ? 0 : -4 }}
              transition={{
                duration: reduced ? 0.2 : 1.1,
                ease: [0.22, 0.61, 0.36, 1],
              }}
              className="max-w-md text-center font-serif text-[clamp(1.35rem,4.2vw,2.1rem)] leading-snug text-balance whitespace-pre-line"
            >
              {line}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* ARRIVE — the one tap that unlocks everything afterwards. */}
      {phase === "arrive" && (
        <button
          type="button"
          onClick={beginNight}
          className="absolute inset-0 flex items-end justify-center pb-[18vh]"
        >
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.6, 0.6, 0.25] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="font-serif text-lg tracking-wide"
          >
            {device === "phone" ? "Touch to begin" : "Click to begin"}
          </motion.span>
        </button>
      )}

      {/* HEADPHONES */}
      {phase === "headphones" && (
        <div className="absolute inset-x-0 bottom-[16vh] flex justify-center gap-10">
          <Choice onClick={() => void teach(true)}>yes</Choice>
          <Choice onClick={() => void teach(false)} muted>
            no
          </Choice>
        </div>
      )}

      {/* PAIRING OFFER */}
      {phase === "pair-offer" && (
        <div className="absolute inset-x-0 bottom-[16vh] flex justify-center gap-10">
          <Choice onClick={() => void offerPairing()}>I have it</Choice>
          <Choice onClick={() => void desktopAlone()} muted>
            not with me
          </Choice>
        </div>
      )}

      {/* QR */}
      <AnimatePresence>
        {phase === "pair-wait" && qr && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2 }}
            className="absolute inset-x-0 bottom-[8vh] flex flex-col items-center gap-3"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qr}
              alt="Scan to bring your phone into the night"
              className="h-44 w-44 opacity-90"
            />
            <p className="font-mono text-xs tracking-[0.3em] text-[#e9e6da]/50">
              {code}
            </p>
            {!originReachable && (
              <p className="max-w-xs text-center text-[11px] text-amber-200/70">
                This code points at {window.location.host}, which your phone
                probably can&apos;t reach. Open the night from its deployed
                address to pair.
              </p>
            )}
            <button
              type="button"
              onClick={() => void desktopAlone()}
              className="mt-2 text-xs text-[#e9e6da]/35 underline-offset-4 hover:underline"
            >
              continue without it
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DOORWAY */}
      <AnimatePresence>
        {phase === "doorway" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.6, delay: 0.6 }}
            className="absolute inset-x-0 bottom-[7vh] flex flex-col items-center gap-5 px-8"
          >
            <ul className="flex w-full max-w-md flex-col gap-2">
              {ACT_V.choices.map((c, i) => (
                <motion.li
                  key={c.id}
                  initial={{ opacity: 0, y: reduced ? 0 : 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 1.1,
                    delay:
                      ACT_V.choicesAfter / 1000 +
                      i * (ACT_V.choiceStagger / 1000),
                    ease: [0.22, 0.61, 0.36, 1],
                  }}
                >
                  <button
                    type="button"
                    onClick={() => void choose(c.id)}
                    className="group flex min-h-14 w-full flex-col items-start rounded-md px-4 py-2 text-left transition-colors hover:bg-white/[0.04]"
                  >
                    <span className="font-serif text-xl">{c.label}</span>
                    <span className="text-xs text-[#e9e6da]/45 transition-opacity group-hover:text-[#e9e6da]/70">
                      {c.whisper}
                    </span>
                  </button>
                </motion.li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => void choose("escape")}
              className="min-h-11 text-xs text-[#e9e6da]/35 underline-offset-4 hover:underline"
            >
              {ACT_V.escape.label}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {phase === "inside" && (
        <StayInside
          onLeave={() => {
            pairing.current?.send({ type: "release" });
            window.location.href = "/october";
          }}
        />
      )}

      {chosen && phase === "chosen" && (
        <p className="absolute inset-x-0 bottom-[7vh] text-center font-mono text-[10px] tracking-[0.2em] text-[#e9e6da]/30 uppercase">
          v0 · destinations are fixtures
        </p>
      )}

      {/* A quiet way out, always. Theatre may disobey; the controls do not.
          It goes back to October, not to Passport's general Discovery: this
          night was entered from `/october` and leaving it in the middle
          should not also leave the month. */}
      <a
        href="/october"
        className="absolute top-5 right-5 min-h-11 text-[11px] text-[#e9e6da]/30 underline-offset-4 hover:underline"
      >
        leave
      </a>
    </div>
  );
}

function Choice({
  children,
  onClick,
  muted = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  muted?: boolean;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.6, delay: 1.2 }}
      className={`min-h-12 min-w-24 rounded-full border px-6 font-serif text-lg transition-colors ${
        muted
          ? "border-[#e9e6da]/15 text-[#e9e6da]/55 hover:border-[#e9e6da]/30"
          : "border-[#e9e6da]/40 hover:bg-white/[0.05]"
      }`}
    >
      {children}
    </motion.button>
  );
}
