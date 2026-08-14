"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import { ArrowLeft, Mic, Sparkles } from "lucide-react";
import { ActShell, BigLine, Reveal } from "../components";
import {
  CRUSH_AVOID_LINES,
  CRUSH_AVOID_THRESHOLD,
  CRUSH_LINES,
  CRUSH_THRESHOLD,
  DISCOVERY_MODES,
  DOWN_SWIPE_LINES,
  ENDING_LINES,
  HESITATION_LINES,
  LEFT_SWIPE_LINES,
  RIGHT_SWIPE_LINES,
  SUPER_LIKE_FALLBACKS,
  SWIPE_CARDS,
  TALK_BACK_CHANCE,
  VOICE_DECK_IDS,
  VOICE_REQUEST,
  type SwipeCard,
  type Vibe,
} from "./content";

type Direction = "up" | "down" | "left" | "right";

const SWIPE_DISTANCE = 110;
const SWIPE_VELOCITY = 500;

function resolveDirection(info: PanInfo): Direction | null {
  const { offset, velocity } = info;
  if (Math.abs(offset.y) > Math.abs(offset.x)) {
    if (offset.y < -SWIPE_DISTANCE || velocity.y < -SWIPE_VELOCITY) return "up";
    if (offset.y > SWIPE_DISTANCE || velocity.y > SWIPE_VELOCITY) return "down";
  } else {
    if (offset.x > SWIPE_DISTANCE || velocity.x > SWIPE_VELOCITY)
      return "right";
    if (offset.x < -SWIPE_DISTANCE || velocity.x < -SWIPE_VELOCITY)
      return "left";
  }
  return null;
}

function flyTarget(dir: Direction) {
  switch (dir) {
    case "up":
      return { x: 0, y: -700, rotate: 0, opacity: 0 };
    case "down":
      return { x: 0, y: 500, rotate: 0, opacity: 0 };
    case "left":
      return { x: -600, y: 40, rotate: -18, opacity: 0 };
    case "right":
      return { x: 600, y: 40, rotate: 18, opacity: 0 };
  }
}

function shuffled<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

const BOARD_STAGE = [
  { min: 20, label: "Overflowing. As it should be." },
  { min: 10, label: "Alive." },
  { min: 5, label: "Growing." },
  { min: 1, label: "Tiny. But it's started." },
  { min: 0, label: "Empty. Swipe up on something." },
];

const CELEBRATION_THRESHOLDS = [5, 10, 20];

/**
 * Experiment 02 — "Discovery Swipe." A real, working card-stack
 * interaction: drag with a mouse or finger, or use the four buttons.
 * Everything numeric (the board, the streak, which vibe has a crush on
 * you) is computed live from real interaction history; only the eighteen
 * cards themselves are invented content, same disclosed exception as
 * Experiment 01's sandboxes.
 *
 * One deliberate SSR-safety note, worth keeping for any future swipe/deck
 * prototype: the *initial* deck is the content's natural order, not
 * shuffled — `Math.random()` in the first render would disagree between
 * the server-rendered HTML and the client hydration pass. Shuffling only
 * ever happens inside an event handler (refilling the deck after a
 * swipe), which is client-only by construction, so it's free to be as
 * random as it wants.
 */
export function DiscoverySwipeExperiment() {
  const [deck, setDeck] = useState<{ uid: string; card: SwipeCard }[]>(() =>
    SWIPE_CARDS.map((card, i) => ({ uid: `${card.id}-${i}`, card })),
  );
  const [board, setBoard] = useState<string[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  const [streak, setStreak] = useState(0);
  const [reaction, setReaction] = useState<string | null>(null);
  const [talkBack, setTalkBack] = useState<string | null>(null);
  const [heartBurst, setHeartBurst] = useState(0);
  const [flying, setFlying] = useState<{ uid: string; dir: Direction } | null>(
    null,
  );
  const [hesitation, setHesitation] = useState(0);
  const [voice, setVoice] = useState<"idle" | "listening" | "revealed">("idle");
  const [celebrating, setCelebrating] = useState<number | null>(null);
  const [lastCelebrated, setLastCelebrated] = useState(0);
  const [crushShown, setCrushShown] = useState<Set<Vibe>>(new Set());
  const [avoidShown, setAvoidShown] = useState<Set<Vibe>>(new Set());
  const [activeCrush, setActiveCrush] = useState<string | null>(null);

  const current = deck[0];
  const upNext = deck[1];

  // Hesitation Engine — resets every time the top card changes, ticks once a second while it's showing.
  // The reset-to-zero is inherent to synchronizing a UI timer with "which card is current," the same
  // legitimate case TrackRating.tsx's own eslint-disable documents for a similar external-clock reset.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting the hesitation clock is the sync itself, not a derivable value
    setHesitation(0);
    if (!current) return;
    const interval = window.setInterval(
      () => setHesitation((h) => h + 1),
      1000,
    );
    return () => window.clearInterval(interval);
  }, [current]);

  const tally = useMemo(() => {
    const counts: Record<Vibe, number> = {
      water: 0,
      adrenaline: 0,
      chill: 0,
      social: 0,
      nature: 0,
      food: 0,
    };
    for (const id of board) {
      const card = SWIPE_CARDS.find((c) => c.id === id);
      if (card) for (const v of card.vibes) counts[v] += 1;
    }
    return counts;
  }, [board]);

  const nopeTally = useMemo(() => {
    const counts: Record<Vibe, number> = {
      water: 0,
      adrenaline: 0,
      chill: 0,
      social: 0,
      nature: 0,
      food: 0,
    };
    for (const id of rejected) {
      const card = SWIPE_CARDS.find((c) => c.id === id);
      if (card) for (const v of card.vibes) counts[v] += 1;
    }
    return counts;
  }, [rejected]);

  const boardStage = BOARD_STAGE.find((s) => board.length >= s.min)!;

  function refillIfLow(remaining: { uid: string; card: SwipeCard }[]) {
    if (remaining.length > 2) return remaining;
    const pool =
      voice === "revealed"
        ? SWIPE_CARDS.filter((c) => VOICE_DECK_IDS.includes(c.id))
        : SWIPE_CARDS;
    const fresh = shuffled(pool).map((card, i) => ({
      uid: `${card.id}-${Date.now()}-${i}`,
      card,
    }));
    return [...remaining, ...fresh];
  }

  function handleSwipe(dir: Direction) {
    if (!current || flying) return;
    setFlying({ uid: current.uid, dir });

    const { card } = current;
    const positive = dir === "up" || dir === "right";
    // Phase 2 — "The Card Talks Back": rare, only on a positive swipe, only for cards with something to say.
    const rolledTalkBack =
      positive && card.talkBack && Math.random() < TALK_BACK_CHANCE;

    let line: string;
    if (dir === "up") {
      line =
        card.reaction ??
        SUPER_LIKE_FALLBACKS[board.length % SUPER_LIKE_FALLBACKS.length]!;
      setStreak((s) => s + 1);
      setHeartBurst((n) => n + 1);
      setBoard((prev) => {
        const next = [...prev, card.id];
        const hit = CELEBRATION_THRESHOLDS.find(
          (t) => next.length >= t && lastCelebrated < t,
        );
        if (hit) {
          setLastCelebrated(hit);
          setCelebrating(hit);
          window.setTimeout(() => setCelebrating(null), 2000);
        }
        return next;
      });
      for (const v of card.vibes) {
        const newCount = tally[v] + 1;
        if (newCount >= CRUSH_THRESHOLD && !crushShown.has(v)) {
          setCrushShown((prev) => new Set(prev).add(v));
          setActiveCrush(CRUSH_LINES[v]);
          window.setTimeout(() => setActiveCrush(null), 3600);
        }
      }
    } else if (dir === "right") {
      line = RIGHT_SWIPE_LINES[streak % RIGHT_SWIPE_LINES.length]!;
      setStreak((s) => s + 1);
      setHeartBurst((n) => n + 1);
    } else if (dir === "down") {
      line = DOWN_SWIPE_LINES[streak % DOWN_SWIPE_LINES.length]!;
    } else {
      line = LEFT_SWIPE_LINES[streak % LEFT_SWIPE_LINES.length]!;
      setRejected((prev) => {
        const next = [...prev, card.id];
        return next;
      });
      for (const v of card.vibes) {
        const newCount = nopeTally[v] + 1;
        if (
          newCount >= CRUSH_AVOID_THRESHOLD &&
          !avoidShown.has(v) &&
          !crushShown.has(v)
        ) {
          setAvoidShown((prev) => new Set(prev).add(v));
          setActiveCrush(CRUSH_AVOID_LINES[v]);
          window.setTimeout(() => setActiveCrush(null), 3600);
        }
      }
    }

    if (rolledTalkBack && card.talkBack) {
      const options = card.talkBack;
      setTalkBack(options[Math.floor(Math.random() * options.length)]!);
      window.setTimeout(() => setTalkBack(null), 2200);
    } else {
      setReaction(line);
      window.setTimeout(() => setReaction(null), 1500);
    }

    window.setTimeout(() => {
      setDeck((prev) => refillIfLow(prev.slice(1)));
      setFlying(null);
    }, 300);
  }

  function startVoiceMode() {
    setVoice("listening");
    window.setTimeout(() => {
      setVoice("revealed");
      setDeck(
        shuffled(SWIPE_CARDS.filter((c) => VOICE_DECK_IDS.includes(c.id))).map(
          (card, i) => ({
            uid: `${card.id}-voice-${i}`,
            card,
          }),
        ),
      );
    }, 2200);
  }

  return (
    <main className="bg-[#171208] text-[#f3ead9]">
      <style>{`
        @keyframes float-up {
          0% { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(-120px); opacity: 0; }
        }
        @keyframes pulse-dots {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        @keyframes breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.015); }
        }
        @keyframes sparkle-in {
          0% { transform: scale(0.6) rotate(-10deg); opacity: 0; }
          60% { transform: scale(1.1) rotate(6deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
      `}</style>

      <Link
        href="/about/ideas-to-make-pages"
        className="fixed top-4 left-4 z-50 flex items-center gap-1.5 rounded-full border border-current/15 bg-[#171208]/80 px-3 py-1.5 text-xs font-medium backdrop-blur-sm transition-opacity hover:opacity-70"
      >
        <ArrowLeft className="h-3 w-3" />
        ELK Labs
      </Link>

      <div className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-full border border-current/15 bg-[#171208]/80 px-3 py-1.5 text-xs font-medium backdrop-blur-sm">
        🔥 {board.length} on the board
      </div>

      {/* ============================================================ */}
      {/* OPENING */}
      {/* ============================================================ */}
      <ActShell
        tone="dark"
        className="flex min-h-[100svh] flex-col items-center justify-center px-6 text-center"
      >
        <Reveal>
          <p className="mb-6 text-xs font-medium tracking-[0.35em] uppercase opacity-50">
            ELK Labs — Experiment 02
          </p>
          <BigLine size="massive">SWIPE.</BigLine>
        </Reveal>
        <Reveal delay={0.3}>
          <p className="mt-6 max-w-lg text-lg opacity-70">Discovery Swipe</p>
        </Reveal>
        <Reveal delay={0.5}>
          <p className="mt-8 max-w-md text-sm opacity-50">
            What if discovering your next adventure felt as addictive as
            discovering your next favourite song?
          </p>
        </Reveal>
        <Reveal delay={0.7}>
          <p className="mt-10 max-w-sm text-xs leading-relaxed italic opacity-30">
            Eighteen invented adventures. Every reaction below is real — the
            cards are not. Not shipping software. Discovering an interaction.
          </p>
        </Reveal>
      </ActShell>

      {/* ============================================================ */}
      {/* THE STACK */}
      {/* ============================================================ */}
      <ActShell tone="light" className="px-6 py-24 md:py-32">
        <div className="mx-auto flex max-w-md flex-col items-center">
          <Reveal>
            <p className="text-center text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Drag, or use the buttons
            </p>
          </Reveal>

          <div className="relative mt-10 h-[440px] w-full max-w-sm">
            {upNext && (
              <div
                className="absolute inset-0 scale-[0.94] rounded-3xl bg-[#241a10]/10"
                aria-hidden
              />
            )}
            <AnimatePresence>
              {current && (
                <motion.div
                  key={current.uid}
                  drag={!flying}
                  dragElastic={0.6}
                  dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                  onDragEnd={(_e, info) => {
                    const dir = resolveDirection(info);
                    if (dir) handleSwipe(dir);
                  }}
                  initial={{ scale: 0.96, opacity: 0 }}
                  animate={
                    flying?.uid === current.uid
                      ? flyTarget(flying.dir)
                      : { x: 0, y: 0, rotate: 0, opacity: 1, scale: 1 }
                  }
                  transition={{
                    duration: flying ? 0.3 : 0.25,
                    ease: "easeOut",
                  }}
                  className="absolute inset-0 flex cursor-grab flex-col items-center justify-center gap-6 rounded-3xl border border-current/10 bg-gradient-to-br from-[#f7ecd3] to-[#efe0bd] p-8 text-center text-[#241a10] shadow-2xl active:cursor-grabbing"
                  style={
                    !flying
                      ? { animation: "breathe 4.5s ease-in-out infinite" }
                      : undefined
                  }
                >
                  <span className="text-7xl">{current.card.emoji}</span>
                  <div>
                    <p className="font-heading text-3xl tracking-tight">
                      {current.card.title}
                    </p>
                    <p className="mt-3 max-w-xs text-base leading-relaxed italic opacity-70">
                      {current.card.line}
                    </p>
                  </div>
                  {hesitation >= 2 && !flying && (
                    <p
                      className="absolute bottom-6 text-xs tracking-widest opacity-50"
                      style={{
                        animation: "pulse-dots 1.4s ease-in-out infinite",
                      }}
                    >
                      {hesitation < 3
                        ? "···"
                        : HESITATION_LINES[
                            Math.min(
                              hesitation - 3,
                              HESITATION_LINES.length - 1,
                            )
                          ]}
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Micro reaction — tiny heart pulse on a positive swipe */}
            <AnimatePresence>
              {heartBurst > 0 && (
                <motion.span
                  key={heartBurst}
                  className="pointer-events-none absolute inset-x-0 top-1/2 z-10 text-center text-3xl"
                  style={{ animation: "float-up 1s ease-out forwards" }}
                >
                  💛
                </motion.span>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {reaction && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="pointer-events-none absolute inset-x-0 -top-4 z-10 flex justify-center"
                >
                  <span className="rounded-full bg-[#171208] px-4 py-2 text-sm font-medium text-[#f3ead9] shadow-lg">
                    {reaction}
                  </span>
                </motion.div>
              )}
              {talkBack && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="pointer-events-none absolute inset-x-0 -top-6 z-10 flex justify-center"
                >
                  <span
                    className="font-heading flex items-center gap-1.5 rounded-full bg-[#ff5a1f] px-5 py-2.5 text-base text-[#171208] shadow-xl"
                    style={{ animation: "sparkle-in 0.4s ease-out" }}
                  >
                    ✨ {talkBack}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="mt-8 grid grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => handleSwipe("left")}
              className="flex flex-col items-center gap-1 rounded-2xl border border-current/15 px-4 py-3 text-2xl transition-transform hover:scale-105 active:scale-95"
            >
              👋
              <span className="text-[10px] font-medium tracking-wide uppercase opacity-50">
                Not today
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleSwipe("down")}
              className="flex flex-col items-center gap-1 rounded-2xl border border-current/15 px-4 py-3 text-2xl transition-transform hover:scale-105 active:scale-95"
            >
              🤔
              <span className="text-[10px] font-medium tracking-wide uppercase opacity-50">
                Maybe
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleSwipe("right")}
              className="flex flex-col items-center gap-1 rounded-2xl border border-current/15 px-4 py-3 text-2xl transition-transform hover:scale-105 active:scale-95"
            >
              ❤️
              <span className="text-[10px] font-medium tracking-wide uppercase opacity-50">
                Interesting
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleSwipe("up")}
              className="flex flex-col items-center gap-1 rounded-2xl bg-[#ff5a1f] px-4 py-3 text-2xl text-[#171208] transition-transform hover:scale-105 active:scale-95"
            >
              🔥
              <span className="text-[10px] font-bold tracking-wide uppercase">
                Hell yeah
              </span>
            </button>
          </div>

          {streak >= 3 && (
            <Reveal>
              <p className="mt-8 text-sm opacity-60">
                You&apos;ve discovered {streak} thing{streak === 1 ? "" : "s"}{" "}
                that caught your eye tonight.
              </p>
            </Reveal>
          )}
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* THE CRUSH SYSTEM (toast) */}
      {/* ============================================================ */}
      <AnimatePresence>
        {activeCrush && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-6"
          >
            <span className="font-heading rounded-full bg-[#ff5a1f] px-6 py-3 text-center text-lg text-[#171208] shadow-xl">
              {activeCrush}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================================ */}
      {/* THE BOARD */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <p className="text-xs font-semibold tracking-[0.15em] uppercase opacity-50">
              The Mood Board
            </p>
            <p className="mt-3 text-sm opacity-50">
              Not an itinerary. Not a saved list. Everything you swiped up on.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <p
              className="font-heading mt-8 transition-all duration-300"
              style={{ fontSize: `clamp(3rem, ${5 + board.length}vw, 8rem)` }}
            >
              {board.length}
            </p>
            <p className="mt-2 text-sm opacity-50">{boardStage.label}</p>
          </Reveal>
          {board.length > 0 && (
            <div className="mt-8 flex flex-wrap justify-center gap-2">
              {board.map((id, i) => {
                const card = SWIPE_CARDS.find((c) => c.id === id);
                if (!card) return null;
                return (
                  <motion.span
                    key={`${id}-${i}`}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-full border border-current/20 px-3 py-1 text-sm opacity-80"
                  >
                    {card.emoji} {card.title}
                  </motion.span>
                );
              })}
            </div>
          )}
          <AnimatePresence>
            {celebrating !== null && (
              <motion.p
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="font-heading mt-8 text-2xl text-[#ff5a1f]"
              >
                {celebrating} ideas. The board is alive.
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* THE HESITATION ENGINE (explainer) */}
      {/* ============================================================ */}
      <ActShell tone="light" className="px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <p className="text-xs font-semibold tracking-[0.15em] uppercase opacity-50">
              The Hesitation Engine
            </p>
            <p className="mt-4 text-xl leading-relaxed opacity-80">
              Passport doesn&apos;t only learn from swipes. It learns from
              pausing. Sit on a card above for a few seconds without deciding —
              watch what happens underneath it. Time is a signal too.
            </p>
          </Reveal>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* OPEN YOUR EYES */}
      {/* ============================================================ */}
      <ActShell
        tone="dark"
        className="flex min-h-[70svh] flex-col items-center justify-center px-6 text-center"
      >
        <Reveal>
          <p className="mb-6 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
            The &ldquo;Open Your Eyes&rdquo; Moment
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="max-w-md text-lg leading-relaxed opacity-70">
            Close your eyes. Say what kind of day you want. Passport listens —
            no form, no filters.
          </p>
        </Reveal>

        {voice === "idle" && (
          <Reveal delay={0.25}>
            <button
              type="button"
              onClick={startVoiceMode}
              className="mt-10 flex items-center gap-2 rounded-full bg-[#ff5a1f] px-6 py-3 text-base font-bold text-[#171208] transition-transform hover:scale-105"
            >
              <Mic className="h-4 w-4" />
              Try it
            </button>
            <p className="mt-4 max-w-xs text-xs italic opacity-40">
              Simulated — no microphone is used. This prototypes the feeling,
              not real speech recognition.
            </p>
          </Reveal>
        )}

        {voice === "listening" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-10 flex flex-col items-center gap-3"
          >
            <Mic className="h-8 w-8 animate-pulse text-[#ff5a1f]" />
            <div className="flex flex-col gap-1">
              {VOICE_REQUEST.map((line, i) => (
                <motion.p
                  key={line}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.5 }}
                  className="text-sm italic opacity-60"
                >
                  {line}
                </motion.p>
              ))}
            </div>
          </motion.div>
        )}

        {voice === "revealed" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-10 flex flex-col items-center gap-4"
          >
            <Sparkles className="h-8 w-8 text-[#ff5a1f]" />
            <BigLine size="medium">Open your eyes.</BigLine>
            <p className="max-w-sm text-sm opacity-60">
              The stack up above just changed completely. Scroll up — same
              eighteen ideas, entirely different energy.
            </p>
          </motion.div>
        )}
      </ActShell>

      {/* ============================================================ */}
      {/* DISCOVERY MODES */}
      {/* ============================================================ */}
      <ActShell tone="light" className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <p className="text-center text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Swipe Is Only One Discovery Language
            </p>
            <p className="mx-auto mt-4 max-w-xl text-center text-lg leading-relaxed opacity-70">
              Seven doorways into future experiments. None built yet — each one
              is its own future sandbox.
            </p>
          </Reveal>
          <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {DISCOVERY_MODES.map((mode, i) => (
              <Reveal key={mode.title} delay={Math.min(i * 0.05, 0.3)}>
                <div className="flex h-full flex-col gap-2 rounded-2xl border border-current/15 p-6">
                  <span className="text-3xl">{mode.emoji}</span>
                  <p className="font-heading text-xl">{mode.title}</p>
                  <p className="text-sm opacity-60">{mode.line}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* FINAL QUESTION */}
      {/* ============================================================ */}
      <ActShell
        tone="dark"
        className="flex min-h-[70svh] flex-col items-center justify-center px-6 text-center"
      >
        <Reveal>
          <p className="mb-8 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
            Final Question
          </p>
        </Reveal>
        <Reveal delay={0.15}>
          <BigLine size="huge">
            Did that feel like discovery, or like sorting a database?
          </BigLine>
        </Reveal>
        <Reveal delay={0.4}>
          <p className="mt-10 max-w-md text-base opacity-50">
            If it felt like a database, delete it and start again.
          </p>
        </Reveal>
      </ActShell>

      {/* ============================================================ */}
      {/* THE ENDING — one quiet observation, no buttons, no marketing */}
      {/* ============================================================ */}
      <ActShell
        tone="dark"
        className="flex min-h-[90svh] flex-col items-center justify-center bg-black px-6 text-center"
      >
        <Reveal delay={0.2}>
          <p className="text-2xl italic opacity-60 md:text-3xl">
            {ENDING_LINES[0]}
          </p>
        </Reveal>
        <Reveal delay={1.1}>
          <p className="font-heading mt-6 text-3xl tracking-tight md:text-5xl">
            {ENDING_LINES[1]}
          </p>
        </Reveal>
      </ActShell>

      {/* ============================================================ */}
      {/* LAB NOTES */}
      {/* ============================================================ */}
      <ActShell tone="light" className="px-6 py-32 md:py-48">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <p className="text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Lab Notes
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-6 text-lg leading-relaxed opacity-70">
              KEEP, CHANGE, COMBINE, or TRASH — same rule as every ELK Labs
              experiment. This one tests one thing: does swiping feel like
              discovery. Not meant to ship as shown.
            </p>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="mt-8 text-sm opacity-50">
              Experiment 01 tested pacing and one extreme persona —{" "}
              <Link
                href="/about/experiment-01-discovery-space"
                className="underline decoration-current/30 underline-offset-4 hover:decoration-current"
              >
                Discovery Space
              </Link>{" "}
              and{" "}
              <Link
                href="/about/experiment-01-bachelor-party"
                className="underline decoration-current/30 underline-offset-4 hover:decoration-current"
              >
                HELL YEAH
              </Link>
              . Experiment 03 —{" "}
              <Link
                href="/about/experiment-03-october-passport"
                className="underline decoration-current/30 underline-offset-4 hover:decoration-current"
              >
                October Passport
              </Link>{" "}
              — tests a seasonal personality instead.
            </p>
          </Reveal>
          <Reveal delay={0.25}>
            <Link
              href="/about/ideas-to-make-pages"
              className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-current/20 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-current/5"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to the wall
            </Link>
          </Reveal>
        </div>
      </ActShell>
    </main>
  );
}
