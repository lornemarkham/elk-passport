"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Flame, Music, Star, Video } from "lucide-react";
import { ActShell, BigLine, Reveal, VideoSlot } from "../components";
import {
  BEER_BETS,
  CREW,
  GOLD_STARS,
  HYPE_MAN_POOL,
  HYPE_MAN_RULES,
  HYPE_VIDEOS,
  IDEA_CARDS,
  MUSIC_BY_TIER,
  OPENING_SCRIPT,
  TAG_CHAMPION,
  TAG_LABEL,
  type IdeaTag,
} from "./content";

const METER_STATES = [
  { max: 16, emoji: "😐", label: "meh" },
  { max: 33, emoji: "🙂", label: "maybe" },
  { max: 50, emoji: "😄", label: "okay..." },
  { max: 70, emoji: "🔥", label: "OH YEAH" },
  { max: 90, emoji: "🚀", label: "HELL YEAH" },
  { max: 100, emoji: "🤯", label: "WE ARE ABSOLUTELY DOING THIS" },
] as const;

function meterState(energy: number) {
  return (
    METER_STATES.find((s) => energy <= s.max) ??
    METER_STATES[METER_STATES.length - 1]
  );
}

type Tier = "calm" | "hyped" | "unhinged";
function tierOf(energy: number): Tier {
  if (energy >= 67) return "unhinged";
  if (energy >= 34) return "hyped";
  return "calm";
}

function seed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997;
  return h;
}

const CELEBRATION_THRESHOLDS = [10, 20, 30];

interface CardTally {
  hellYeah: number;
  nope: number;
}

/**
 * Experiment 01B — "HELL YEAH, The Bachelor Party Experiment." One client
 * component, not several, because almost everything on this page reads or
 * writes the same shared "room energy" — splitting it into independent
 * islands would mean re-deriving that shared state in three places. This
 * is the deliberate exception to this whole app's usual discipline of
 * small, focused components: a lab prototype whose entire premise is
 * "one room, one shared, rising energy," so one shared state tree is the
 * honest shape, not a violation of it.
 *
 * Every number on this page is real (click counts, bucket size, tag
 * tallies) — only the *content* (the six friends, the dialogue, every
 * idea) is invented. See `content.ts`'s own comment for why that's
 * allowed here specifically.
 */
export function BachelorPartyExperiment() {
  const [energy, setEnergy] = useState(0);
  const [scriptRevealed, setScriptRevealed] = useState(0);
  const [bucket, setBucket] = useState<string[]>([]);
  const [tallies, setTallies] = useState<Record<string, CardTally>>({});
  const [stars, setStars] = useState<Set<string>>(new Set());
  const [budgetMode, setBudgetMode] = useState<"normal" | "buying" | "broke">(
    "normal",
  );
  const [beerBetIndex, setBeerBetIndex] = useState(0);
  const [celebrating, setCelebrating] = useState<number | null>(null);
  const [lastCelebrated, setLastCelebrated] = useState(0);

  const tier = tierOf(energy);
  const meter = meterState(energy);
  const music = useMemo(() => {
    let picked = MUSIC_BY_TIER[0][1];
    for (const [threshold, mood] of MUSIC_BY_TIER) {
      if (energy >= threshold) picked = mood;
    }
    return picked;
  }, [energy]);

  const tagCounts = useMemo(() => {
    const counts: Record<IdeaTag, number> = {
      luxury: 0,
      cheap: 0,
      adrenaline: 0,
      food: 0,
      nightlife: 0,
      chill: 0,
    };
    for (const id of bucket) {
      const card = IDEA_CARDS.find((c) => c.id === id);
      if (card) counts[card.tag] += 1;
    }
    return counts;
  }, [bucket]);

  const hellYeahTagCounts = useMemo(() => {
    const counts: Record<IdeaTag, number> = {
      luxury: 0,
      cheap: 0,
      adrenaline: 0,
      food: 0,
      nightlife: 0,
      chill: 0,
    };
    for (const card of IDEA_CARDS) {
      counts[card.tag] += tallies[card.id]?.hellYeah ?? 0;
    }
    return counts;
  }, [tallies]);

  const topTag = useMemo(() => {
    let best: IdeaTag | null = null;
    let bestCount = 0;
    for (const [tag, count] of Object.entries(hellYeahTagCounts) as [
      IdeaTag,
      number,
    ][]) {
      if (count > bestCount) {
        best = tag;
        bestCount = count;
      }
    }
    return best;
  }, [hellYeahTagCounts]);

  const splittingCard = useMemo(
    () =>
      IDEA_CARDS.find(
        (c) =>
          (tallies[c.id]?.hellYeah ?? 0) >= 2 &&
          (tallies[c.id]?.nope ?? 0) >= 2,
      ),
    [tallies],
  );

  const hypeManLine = useMemo(() => {
    const state = { bucketCount: bucket.length, tagCounts, energy };
    const rule = HYPE_MAN_RULES.find((r) => r.test(state));
    if (rule) return rule.line;
    return HYPE_MAN_POOL[bucket.length % HYPE_MAN_POOL.length];
  }, [bucket, tagCounts, energy]);

  function bumpEnergy(amount: number) {
    setEnergy((e) => {
      const next = Math.min(100, e + amount);
      return next;
    });
  }

  function reactToCard(id: string, kind: "hellYeah" | "nope") {
    setTallies((prev) => {
      const current = prev[id] ?? { hellYeah: 0, nope: 0 };
      return { ...prev, [id]: { ...current, [kind]: current[kind] + 1 } };
    });
    if (kind === "hellYeah") {
      bumpEnergy(4);
      setBucket((prev) => {
        if (prev.includes(id)) return prev;
        const next = [...prev, id];
        const hit = CELEBRATION_THRESHOLDS.find(
          (t) => next.length >= t && lastCelebrated < t,
        );
        if (hit) {
          setLastCelebrated(hit);
          setCelebrating(hit);
          window.setTimeout(() => setCelebrating(null), 2200);
        }
        return next;
      });
    } else {
      bumpEnergy(1);
    }
  }

  function toggleStar(star: string) {
    setStars((prev) => {
      const next = new Set(prev);
      if (next.has(star)) next.delete(star);
      else next.add(star);
      return next;
    });
  }

  const cardWrapperClass =
    tier === "unhinged"
      ? "border-[#ff5a1f]/60 shadow-[0_0_30px_-8px_rgba(255,90,31,0.5)]"
      : tier === "hyped"
        ? "border-[#ff5a1f]/30"
        : "border-current/15";

  return (
    <main className="bg-[#171208] text-[#f3ead9]">
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(540deg); opacity: 0.9; }
        }
        @keyframes meter-shake {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          25% { transform: translateX(-3px) rotate(-1deg); }
          75% { transform: translateX(3px) rotate(1deg); }
        }
      `}</style>

      <Link
        href="/about/ideas-to-make-pages"
        className="fixed top-4 left-4 z-50 flex items-center gap-1.5 rounded-full border border-current/15 bg-[#171208]/80 px-3 py-1.5 text-xs font-medium backdrop-blur-sm transition-opacity hover:opacity-70"
      >
        <ArrowLeft className="h-3 w-3" />
        ELK Labs
      </Link>

      {/* Persistent room-energy readout */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-full border border-current/15 bg-[#171208]/80 px-3 py-1.5 text-xs font-medium backdrop-blur-sm">
        <Flame
          className={`h-3.5 w-3.5 ${tier === "unhinged" ? "text-[#ff5a1f]" : "opacity-60"}`}
        />
        Room energy: {energy}
        <span className="opacity-50">·</span>
        <Music className="h-3.5 w-3.5 opacity-60" />
        {music.label}
      </div>

      {celebrating !== null && <ConfettiBurst />}

      {/* ============================================================ */}
      {/* OPENING */}
      {/* ============================================================ */}
      <ActShell
        tone="dark"
        className="flex min-h-[100svh] flex-col items-center justify-center px-6 text-center"
      >
        <Reveal>
          <p className="mb-6 text-xs font-medium tracking-[0.35em] uppercase opacity-50">
            ELK Labs — Experiment 01
          </p>
          <BigLine size="massive">HELL YEAH.</BigLine>
        </Reveal>
        <Reveal delay={0.35}>
          <p className="mt-6 max-w-lg text-lg opacity-70">
            The Bachelor Party Experiment
          </p>
        </Reveal>
        <Reveal delay={0.55}>
          <p className="mt-8 max-w-md text-sm opacity-50">
            Can Passport make planning a bachelor weekend feel almost as fun as
            the weekend itself?
          </p>
        </Reveal>
        <Reveal delay={0.75}>
          <p className="mt-10 max-w-sm text-xs leading-relaxed italic opacity-30">
            One deliberately extreme persona, on purpose. Every idea below is
            invented. This page is not meant to ship as shown — it exists to
            find out what joy looks like as a design constraint.
          </p>
        </Reveal>
      </ActShell>

      {/* ============================================================ */}
      {/* SECTION 01 — THE ROOM */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-32 md:py-48">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Section 01 — The Room
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <BigLine size="huge">YOU HAVE 48 HOURS.</BigLine>
          </Reveal>
          <Reveal delay={0.3}>
            <p className="mt-8 max-w-xl text-lg leading-relaxed opacity-70">
              Six friends. A bachelor weekend. Vernon, the Okanagan.
              Nobody&apos;s opened a category filter. They&apos;re just talking.
            </p>
            <p className="mt-4 text-xs font-medium tracking-[0.2em] uppercase opacity-40">
              {CREW.join(" · ")}
            </p>
          </Reveal>
          <Reveal delay={0.45}>
            <div className="mt-6">
              <BigLine size="medium">
                What kind of weekend are we having?
              </BigLine>
            </div>
          </Reveal>

          <div className="mt-16 flex flex-col gap-4">
            {OPENING_SCRIPT.slice(0, scriptRevealed).map((line, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className={`flex items-baseline gap-3 ${line.yell ? "text-2xl md:text-3xl" : "text-base md:text-lg"}`}
              >
                <span className="shrink-0 text-xs font-medium tracking-widest uppercase opacity-40">
                  {line.speaker}
                </span>
                <span
                  className={`font-heading ${line.yell ? "font-semibold" : ""} opacity-90`}
                >
                  {line.line}
                </span>
              </motion.div>
            ))}
          </div>

          {scriptRevealed < OPENING_SCRIPT.length ? (
            <button
              type="button"
              onClick={() =>
                setScriptRevealed((n) => Math.min(OPENING_SCRIPT.length, n + 3))
              }
              className="mt-10 rounded-full border border-current/20 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-current/10"
            >
              {scriptRevealed === 0 ? "Let them talk" : "Keep going..."}
            </button>
          ) : (
            <p className="mt-10 text-sm italic opacity-40">
              This is the whole point: Passport should understand this
              conversation, not require six people to fill out a form first.
            </p>
          )}
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* SECTION 02 — THE HELL YEAH METER */}
      {/* ============================================================ */}
      <ActShell tone="light" className="px-6 py-32 md:py-48">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Section 02 — The Hell Yeah Meter
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mx-auto max-w-xl text-lg leading-relaxed opacity-70">
              This isn&apos;t a star rating. It&apos;s room energy — press it
              and watch the whole page react.
            </p>
          </Reveal>

          <div
            className="mt-16 select-none"
            style={{
              animation:
                tier === "unhinged" ? "meter-shake 0.3s infinite" : undefined,
            }}
          >
            <span
              className="block transition-all duration-300"
              style={{ fontSize: `clamp(4rem, ${8 + energy / 8}vw, 14rem)` }}
            >
              {meter.emoji}
            </span>
            <p
              className={`font-heading mt-4 tracking-tight transition-all duration-300 ${
                tier === "unhinged" ? "text-[#ff5a1f]" : ""
              }`}
              style={{ fontSize: `clamp(1.5rem, ${3 + energy / 20}vw, 5rem)` }}
            >
              {meter.label}
            </p>
          </div>

          <div className="mx-auto mt-10 h-3 w-full max-w-md overflow-hidden rounded-full border border-current/20">
            <div
              className="h-full bg-[#ff5a1f] transition-all duration-300"
              style={{ width: `${energy}%` }}
            />
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => bumpEnergy(9)}
              className="rounded-full bg-[#ff5a1f] px-8 py-4 text-lg font-bold text-[#171208] shadow-lg transition-transform hover:scale-105 active:scale-95"
            >
              HYPE IT UP
            </button>
            <button
              type="button"
              onClick={() => setEnergy(0)}
              className="rounded-full border border-current/20 px-5 py-3 text-sm font-medium opacity-60 transition-opacity hover:opacity-100"
            >
              Cool the room down
            </button>
          </div>
          <p className="mt-6 text-xs opacity-40">
            Every HELL YEAH click below feeds this meter too — they&apos;re the
            same room.
          </p>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* SECTION 03 — LOUD IDEAS (intro) */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-24">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Section 03 — Loud Ideas
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <BigLine size="medium">
              Passport should encourage chaos. Creative chaos.
            </BigLine>
          </Reveal>
          <Reveal delay={0.25}>
            <p className="mt-6 max-w-xl text-lg leading-relaxed opacity-70">
              Everything below is its own experiment. They don&apos;t need to
              agree with each other yet — that&apos;s the point.
            </p>
          </Reveal>
        </div>
      </ActShell>

      {/* ---- THE HELL YEAH / NO CHANCE BUTTONS (idea grid) ---- */}
      <ActShell tone="light" className="px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <p className="text-xs font-semibold tracking-[0.15em] uppercase opacity-50">
              🔥 The Hell Yeah Button &amp; 😂 The No Chance Button
            </p>
            <p className="mt-3 max-w-2xl text-base opacity-70">
              Not Like. Not Save. Not Favorite. Every idea gets one honest
              reaction, in either direction.
            </p>
          </Reveal>

          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {IDEA_CARDS.map((card) => {
              const t = tallies[card.id] ?? { hellYeah: 0, nope: 0 };
              const inBucket = bucket.includes(card.id);
              const dimmed =
                (budgetMode === "buying" && card.tag !== "luxury") ||
                (budgetMode === "broke" &&
                  card.tag !== "cheap" &&
                  card.tag !== "chill");
              const rotation =
                tier === "calm"
                  ? 0
                  : ((seed(card.id) % 7) - 3) * (tier === "unhinged" ? 1 : 0.4);

              return (
                <motion.div
                  key={card.id}
                  animate={{ rotate: rotation, opacity: dimmed ? 0.35 : 1 }}
                  transition={{ duration: 0.3 }}
                  className={`relative flex flex-col gap-3 rounded-xl border bg-[#f7ecd3]/40 p-4 ${cardWrapperClass}`}
                >
                  {inBucket && (
                    <span className="absolute -top-2 -right-2 rotate-12 rounded-full bg-[#ff5a1f] px-2 py-0.5 text-[10px] font-bold text-[#171208]">
                      IN THE BUCKET
                    </span>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{card.emoji}</span>
                    <div>
                      <p className="font-heading text-lg leading-tight">
                        {card.title}
                      </p>
                      <p className="text-xs opacity-50">
                        {TAG_LABEL[card.tag]}
                      </p>
                    </div>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => reactToCard(card.id, "hellYeah")}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#ff5a1f] px-3 py-2 text-sm font-bold text-[#171208] transition-transform hover:scale-[1.03] active:scale-95"
                    >
                      🔥 HELL YEAH{" "}
                      {t.hellYeah > 0 && (
                        <span className="opacity-70">({t.hellYeah})</span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => reactToCard(card.id, "nope")}
                      className="flex items-center justify-center gap-1.5 rounded-lg border border-current/20 px-3 py-2 text-sm font-medium opacity-70 transition-opacity hover:opacity-100"
                    >
                      😂 {t.nope > 0 && <span>({t.nope})</span>}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </ActShell>

      {/* ---- ROOM ENERGY explainer ---- */}
      <ActShell tone="dark" className="px-6 py-24 text-center">
        <div className="mx-auto max-w-2xl">
          <Reveal>
            <p className="text-xs font-semibold tracking-[0.15em] uppercase opacity-50">
              Room Energy
            </p>
            <p className="mt-4 text-xl leading-relaxed opacity-80">
              Every reaction above didn&apos;t just change one card. It changed
              the room — the meter climbed, the cards started tilting, the whole
              page is a little less composed than it was a minute ago. Look
              around.
            </p>
            <p className="mt-4 text-sm opacity-40">
              Current mood:{" "}
              <span className="font-semibold">
                {tier === "calm"
                  ? "Composed"
                  : tier === "hyped"
                    ? "Getting loud"
                    : "Absolutely unhinged"}
              </span>
            </p>
          </Reveal>
        </div>
      </ActShell>

      {/* ---- HYPE MAN ---- */}
      <ActShell tone="light" className="px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <p className="text-xs font-semibold tracking-[0.15em] uppercase opacity-50">
              The Hype Man (AI)
            </p>
            <p className="mt-3 text-sm opacity-60">
              Not a travel agent. The funniest person in the room, reading it in
              real time.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <AnimatePresence mode="wait">
              <motion.blockquote
                key={hypeManLine}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="font-heading mt-8 text-2xl leading-snug italic md:text-3xl"
              >
                &ldquo;{hypeManLine}&rdquo;
              </motion.blockquote>
            </AnimatePresence>
          </Reveal>
        </div>
      </ActShell>

      {/* ---- BEER BET ---- */}
      <ActShell tone="dark" className="px-6 py-24 text-center">
        <div className="mx-auto max-w-xl">
          <Reveal>
            <p className="text-xs font-semibold tracking-[0.15em] uppercase opacity-50">
              The Beer Bet
            </p>
            <p className="mt-3 text-sm opacity-50">
              No gambling. No money. Only stories and bragging rights.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="font-heading mt-8 text-2xl">
              {BEER_BETS[beerBetIndex]}
            </p>
            <button
              type="button"
              onClick={() => setBeerBetIndex((i) => (i + 1) % BEER_BETS.length)}
              className="mt-6 rounded-full border border-current/20 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-current/10"
            >
              Lock it in
            </button>
          </Reveal>
        </div>
      </ActShell>

      {/* ---- GOLD STAR ECONOMY ---- */}
      <ActShell tone="light" className="px-6 py-24">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <p className="text-xs font-semibold tracking-[0.15em] uppercase opacity-50">
              The Gold Star Economy
            </p>
            <p className="mt-3 text-sm opacity-60">
              Nobody wins money. People earn ridiculous things.
            </p>
          </Reveal>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            {GOLD_STARS.map((star) => {
              const earned = stars.has(star);
              return (
                <button
                  key={star}
                  type="button"
                  onClick={() => toggleStar(star)}
                  className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                    earned
                      ? "border-[#ff5a1f] bg-[#ff5a1f]/15 text-[#241a10]"
                      : "border-current/20 opacity-60 hover:opacity-100"
                  }`}
                >
                  <Star
                    className={`h-3.5 w-3.5 ${earned ? "fill-[#ff5a1f] text-[#ff5a1f]" : ""}`}
                  />
                  {star}
                </button>
              );
            })}
          </div>
        </div>
      </ActShell>

      {/* ---- ARGUMENT ENGINE ---- */}
      <ActShell tone="dark" className="px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <p className="text-xs font-semibold tracking-[0.15em] uppercase opacity-50">
              The Argument Engine
            </p>
            <p className="mt-3 text-sm opacity-50">
              Arguments are fun. Passport should embrace them, not smooth them
              over.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            {splittingCard ? (
              <div className="mt-10">
                <p className="text-lg opacity-70">
                  This one&apos;s splitting the room...
                </p>
                <p className="font-heading mt-3 text-3xl">
                  {splittingCard.emoji} {splittingCard.title}
                </p>
                <div className="mt-6 flex items-center justify-center gap-8 text-xl font-semibold">
                  <span>🔥 {tallies[splittingCard.id]?.hellYeah ?? 0}</span>
                  <span className="opacity-30">vs</span>
                  <span>😂 {tallies[splittingCard.id]?.nope ?? 0}</span>
                </div>
              </div>
            ) : (
              <p className="mt-10 text-base opacity-50">
                Nothing&apos;s splitting the room yet — go hit Hell Yeah and No
                Chance on the same idea a few times.
              </p>
            )}
          </Reveal>
        </div>
      </ActShell>

      {/* ---- HYPE VIDEOS ---- */}
      <ActShell tone="light" className="px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.15em] uppercase opacity-50">
              <Video className="h-3.5 w-3.5" /> Feel This — Hype Videos
            </p>
            <p className="mt-3 max-w-xl text-sm opacity-60">
              Passport sells emotion before information. Fifteen to thirty
              seconds, no narration needed.
            </p>
          </Reveal>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {HYPE_VIDEOS.map((v, i) => (
              <Reveal key={v.title} delay={Math.min(i * 0.05, 0.3)}>
                <VideoSlot title={v.title} beats={v.beats} />
              </Reveal>
            ))}
          </div>
        </div>
      </ActShell>

      {/* ---- I'M BUYING / WE'RE BROKE ---- */}
      <ActShell tone="dark" className="px-6 py-24 text-center">
        <div className="mx-auto max-w-2xl">
          <Reveal>
            <p className="text-xs font-semibold tracking-[0.15em] uppercase opacity-50">
              The &ldquo;I&apos;m Buying&rdquo; Moment &amp; The
              &ldquo;We&apos;re Broke&rdquo; Moment
            </p>
            <p className="mt-3 text-sm opacity-50">
              Adventure shouldn&apos;t require money. Sometimes it helps anyway.
            </p>
          </Reveal>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <button
              type="button"
              onClick={() =>
                setBudgetMode((m) => (m === "buying" ? "normal" : "buying"))
              }
              className={`rounded-full px-6 py-3 text-base font-bold transition-colors ${
                budgetMode === "buying"
                  ? "bg-[#ff5a1f] text-[#171208]"
                  : "border border-current/20 opacity-70 hover:opacity-100"
              }`}
            >
              🥂 I GOT THIS
            </button>
            <button
              type="button"
              onClick={() =>
                setBudgetMode((m) => (m === "broke" ? "normal" : "broke"))
              }
              className={`rounded-full px-6 py-3 text-base font-bold transition-colors ${
                budgetMode === "broke"
                  ? "bg-[#ff5a1f] text-[#171208]"
                  : "border border-current/20 opacity-70 hover:opacity-100"
              }`}
            >
              🌮 WE&apos;RE BROKE
            </button>
          </div>
          {budgetMode !== "normal" && (
            <p className="mt-6 text-sm opacity-60">
              Scroll back up — the idea grid just lit up{" "}
              {budgetMode === "buying"
                ? "every luxury pick"
                : "every cheap, chill pick"}
              .
            </p>
          )}
        </div>
      </ActShell>

      {/* ---- MVP OF THE ROOM ---- */}
      <ActShell tone="light" className="px-6 py-24 text-center">
        <div className="mx-auto max-w-xl">
          <Reveal>
            <p className="text-xs font-semibold tracking-[0.15em] uppercase opacity-50">
              The MVP Of The Room
            </p>
            <p className="mt-3 text-sm opacity-60">
              No profiles. No statistics. Just playful recognition.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            {topTag ? (
              <p className="font-heading mt-8 text-2xl leading-snug">
                {TAG_CHAMPION[topTag].name} {TAG_CHAMPION[topTag].line}
              </p>
            ) : (
              <p className="mt-8 text-base opacity-50">
                Nobody&apos;s pulling ahead yet. Go smash some Hell Yeahs.
              </p>
            )}
          </Reveal>
        </div>
      </ActShell>

      {/* ---- THE ADVENTURE BUCKET ---- */}
      <ActShell tone="dark" className="px-6 py-24">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <p className="text-xs font-semibold tracking-[0.15em] uppercase opacity-50">
              The Adventure Bucket
            </p>
            <p className="mt-3 text-sm opacity-50">
              Not an itinerary. Not a saved list. The Bucket.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <p
              className="font-heading mt-8 transition-all duration-300"
              style={{ fontSize: `clamp(3rem, ${5 + bucket.length}vw, 8rem)` }}
            >
              {bucket.length}
            </p>
            <p className="mt-2 text-sm opacity-50">
              {bucket.length === 0
                ? "Starts tiny."
                : bucket.length < 10
                  ? "Filling up."
                  : "Overflowing. As it should."}
            </p>
          </Reveal>
          {bucket.length > 0 && (
            <div className="mt-8 flex flex-wrap justify-center gap-2">
              {bucket.map((id) => {
                const card = IDEA_CARDS.find((c) => c.id === id);
                if (!card) return null;
                return (
                  <span
                    key={id}
                    className="rounded-full border border-current/20 px-3 py-1 text-sm opacity-80"
                  >
                    {card.emoji} {card.title}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* THE FINAL TEST */}
      {/* ============================================================ */}
      <ActShell
        tone="dark"
        className="flex min-h-[70svh] flex-col items-center justify-center px-6 text-center"
      >
        <Reveal>
          <p className="mb-8 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
            The Final Test
          </p>
        </Reveal>
        <Reveal delay={0.15}>
          <BigLine size="huge">
            Would six friends be laughing right now?
          </BigLine>
        </Reveal>
        <Reveal delay={0.4}>
          <p className="mt-10 max-w-md text-base opacity-50">
            If the answer is no, we failed. Build again.
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
              Every concept above is independent — they weren&apos;t built to
              agree with each other yet. For each one: KEEP, CHANGE, COMBINE, or
              TRASH. This experiment is not meant to ship as shown.
            </p>
          </Reveal>
          <Reveal delay={0.25}>
            <Link
              href="/about/experiment-02-discovery-swipe"
              className="text-sm font-medium underline decoration-current/30 underline-offset-4 hover:decoration-current"
            >
              Experiment 02 — Discovery Swipe →
            </Link>
          </Reveal>
          <Reveal delay={0.35}>
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

const CONFETTI_COLORS = ["#ff5a1f", "#f3ead9", "#8a5a24", "#ffd166"];

function ConfettiBurst() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        left: seed(`c${i}`) % 100,
        delay: (seed(`d${i}`) % 10) / 10,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      })),
    [],
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute top-0 h-3 w-1.5"
          style={{
            left: `${p.left}%`,
            backgroundColor: p.color,
            animation: `confetti-fall 1.8s ease-in ${p.delay}s forwards`,
          }}
        />
      ))}
      <div className="absolute inset-x-0 top-1/3 text-center">
        <p className="font-heading text-4xl text-[#ff5a1f] md:text-6xl">
          THE BOARD IS ALIVE.
        </p>
      </div>
    </div>
  );
}
