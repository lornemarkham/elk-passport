"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ActShell, BigLine, ImageSlot, Reveal } from "../components";
import {
  ATLAS_INGREDIENTS,
  DISCOVERY_THEMES,
  LITTLE_MISSIONS,
  OPEN_QUESTIONS,
  TODAY_WE_ITEMS,
  TUNE_IDEAS,
  WORDS_OF_THE_DAY,
} from "./content";

/**
 * Experiment 04 — "Wonder." Deliberately the smallest, lightest ELK Labs
 * sandbox so far — the brief was explicit: don't solve everything, don't
 * over-engineer, capture the heart. One component, a handful of small,
 * real interactions (click a theme open, pick a word, check off a memory,
 * notice a mission) — no filtering engine, no camera, no ambient particle
 * layer. Everything here is either gentle content or a light toggle;
 * nothing pretends to be more finished than it is.
 */
export function WonderExperiment() {
  const [openTheme, setOpenTheme] = useState<string | null>(null);
  const [wordIndex, setWordIndex] = useState(0);
  const [todayWe, setTodayWe] = useState<Set<string>>(new Set());
  const [missionsDone, setMissionsDone] = useState<Set<string>>(new Set());

  const word = WORDS_OF_THE_DAY[wordIndex]!;

  const keepsakeLine = useMemo(() => {
    const chosen = TODAY_WE_ITEMS.filter((item) => todayWe.has(item.id));
    if (chosen.length === 0) return null;
    const labels = chosen.map((c) => c.label.toLowerCase());
    if (labels.length === 1) return `Today, we ${labels[0]}.`;
    return `Today, we ${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}.`;
  }, [todayWe]);

  function toggleTodayWe(id: string) {
    setTodayWe((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleMission(id: string) {
    setMissionsDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <main className="bg-[#f7ecd3] text-[#241a10]">
      <Link
        href="/about/ideas-to-make-pages"
        className="fixed top-4 left-4 z-50 flex items-center gap-1.5 rounded-full border border-current/15 bg-[#f7ecd3]/80 px-3 py-1.5 text-xs font-medium backdrop-blur-sm transition-opacity hover:opacity-70"
      >
        <ArrowLeft className="h-3 w-3" />
        ELK Labs
      </Link>

      {/* ============================================================ */}
      {/* OPENING */}
      {/* ============================================================ */}
      <ActShell
        tone="light"
        className="flex min-h-[90svh] flex-col items-center justify-center px-6 text-center"
      >
        <Reveal>
          <p className="mb-6 text-xs font-medium tracking-[0.35em] uppercase opacity-50">
            ELK Labs — Experiment 04 — A Sketchbook
          </p>
          <BigLine size="huge">Wonder.</BigLine>
        </Reveal>
        <Reveal delay={0.3}>
          <p className="mt-8 max-w-md text-base opacity-60">
            This one is deliberately unfinished. Not a product. A sketch, kept
            honest about what it still doesn&apos;t know.
          </p>
        </Reveal>
      </ActShell>

      {/* ============================================================ */}
      {/* THE BIG IDEA */}
      {/* ============================================================ */}
      <ActShell tone="light" className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <BigLine size="medium">
              The relationship comes first. The activities come second.
            </BigLine>
          </Reveal>
          <Reveal delay={0.15}>
            <p className="mt-8 text-lg leading-relaxed opacity-75">
              Not a kids app. Not parenting software. This is about two people —
              an uncle and his niece, a parent and a child, grandparents, a
              mentor, friends, anyone — having a genuinely wonderful day
              together. Wonder comes before planning.
            </p>
          </Reveal>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* THE QUESTION */}
      {/* ============================================================ */}
      <ActShell
        tone="dark"
        className="flex min-h-[60svh] flex-col items-center justify-center px-6 text-center"
      >
        <Reveal>
          <p className="text-xl italic line-through decoration-2 opacity-50">
            &ldquo;What do you want to do?&rdquo;
          </p>
        </Reveal>
        <Reveal delay={0.3}>
          <BigLine size="large" className="mt-8">
            &ldquo;What are we curious about today?&rdquo;
          </BigLine>
        </Reveal>
        <Reveal delay={0.5}>
          <p className="mt-8 max-w-sm text-sm opacity-50">
            Everything else flows from that one change.
          </p>
        </Reveal>
      </ActShell>

      {/* ============================================================ */}
      {/* DISCOVERY THEMES */}
      {/* ============================================================ */}
      <ActShell tone="light" className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <p className="text-center text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Little Worlds — Tap One Open
            </p>
          </Reveal>
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {DISCOVERY_THEMES.map((theme, i) => {
              const open = openTheme === theme.id;
              return (
                <Reveal key={theme.id} delay={Math.min(i * 0.02, 0.2)}>
                  <button
                    type="button"
                    onClick={() => setOpenTheme(open ? null : theme.id)}
                    className="flex h-full w-full flex-col items-center gap-1.5 rounded-xl border border-current/15 p-4 text-center transition-colors hover:bg-current/5"
                  >
                    <span className="text-2xl">{theme.emoji}</span>
                    <span className="text-sm font-medium">{theme.title}</span>
                    {open && (
                      <span className="mt-1 text-xs italic opacity-60">
                        {theme.line}
                      </span>
                    )}
                  </button>
                </Reveal>
              );
            })}
          </div>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* WORD OF THE DAY */}
      {/* ============================================================ */}
      <ActShell tone="light" className="px-6 py-24 text-center">
        <div className="mx-auto max-w-xl">
          <Reveal>
            <p className="text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Word of the Day
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <BigLine size="large" className="mt-6">
              {word.word}.
            </BigLine>
            <p className="mt-4 text-base italic opacity-60">{word.line}</p>
          </Reveal>
          <Reveal delay={0.2}>
            <button
              type="button"
              onClick={() =>
                setWordIndex((i) => (i + 1) % WORDS_OF_THE_DAY.length)
              }
              className="mt-8 rounded-full border border-current/20 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-current/5"
            >
              A different word
            </button>
          </Reveal>
          <Reveal delay={0.3}>
            <p className="mt-6 max-w-sm text-xs italic opacity-40">
              Never preached. Never taught directly. Just an opportunity,
              quietly offered.
            </p>
          </Reveal>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* TODAY WE... */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <p className="text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Today We...
            </p>
            <p className="mt-4 text-sm opacity-50">
              Not an itinerary. A memory journal, built as the day happens.
            </p>
          </Reveal>
          <div className="mt-10 flex flex-wrap justify-center gap-2">
            {TODAY_WE_ITEMS.map((item) => {
              const checked = todayWe.has(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleTodayWe(item.id)}
                  className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                    checked
                      ? "border-[#ff5a1f] bg-[#ff5a1f]/15"
                      : "border-current/20 opacity-60 hover:opacity-100"
                  }`}
                >
                  {item.emoji} {item.label}
                </button>
              );
            })}
          </div>
          {keepsakeLine && (
            <Reveal>
              <p className="font-heading mt-10 text-2xl leading-relaxed italic">
                {keepsakeLine}
              </p>
              <p className="mt-3 text-xs opacity-40">
                A printable keepsake is the real idea here — not built yet,
                deliberately. This is the shape of it.
              </p>
            </Reveal>
          )}
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* TUNES FOR THE TRIP */}
      {/* ============================================================ */}
      <ActShell tone="light" className="px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <p className="text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Tunes for the Trip
            </p>
            <p className="mt-4 max-w-lg text-lg leading-relaxed opacity-70">
              Music becomes part of the adventure. The soundtrack belongs to the
              memory, not to a playlist app.
            </p>
          </Reveal>
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {TUNE_IDEAS.map((idea) => (
              <span
                key={idea}
                className="rounded-full border border-current/20 px-3 py-1.5 text-sm opacity-70"
              >
                {idea}
              </span>
            ))}
          </div>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* LITTLE MISSIONS */}
      {/* ============================================================ */}
      <ActShell tone="light" className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <p className="text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Little Missions
            </p>
            <p className="mt-4 text-sm opacity-50">
              Not achievements. Tiny invitations to notice something.
            </p>
          </Reveal>
          <div className="mt-10 flex flex-col gap-2 text-left">
            {LITTLE_MISSIONS.map((mission) => {
              const done = missionsDone.has(mission.id);
              return (
                <button
                  key={mission.id}
                  type="button"
                  onClick={() => toggleMission(mission.id)}
                  className="flex items-center gap-3 rounded-lg border border-current/10 px-4 py-3 text-left transition-colors hover:bg-current/5"
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs ${
                      done
                        ? "border-[#ff5a1f] bg-[#ff5a1f] text-[#171208]"
                        : "border-current/30"
                    }`}
                  >
                    {done ? "✓" : ""}
                  </span>
                  <span className="text-lg">{mission.emoji}</span>
                  <span className={done ? "line-through opacity-50" : ""}>
                    {mission.prompt}
                  </span>
                </button>
              );
            })}
          </div>
          {missionsDone.size > 0 && (
            <p className="mt-6 text-sm opacity-50">
              {missionsDone.size} noticed so far. No score. No rush.
            </p>
          )}
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* ATLAS */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <BigLine size="medium">
              Atlas quietly builds the day. Passport creates the wonder.
            </BigLine>
          </Reveal>
          <Reveal delay={0.15}>
            <p className="mt-6 text-sm opacity-50">
              What Atlas would need to know for this — mostly not built yet,
              named honestly:
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {ATLAS_INGREDIENTS.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-current/20 px-3 py-1 text-sm opacity-70"
                >
                  {item}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* VISUAL FEELING */}
      {/* ============================================================ */}
      <ActShell tone="light" className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-4xl">
          <Reveal>
            <p className="text-center text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Visual Feeling
            </p>
            <p className="mx-auto mt-4 max-w-lg text-center text-lg leading-relaxed opacity-70">
              Warm. Handwritten. Sketches. Pressed flowers. Polaroids. This
              should feel like a keepsake someone actually kept.
            </p>
          </Reveal>
          <div className="mt-12 flex flex-wrap justify-center gap-4">
            <ImageSlot
              label="Polaroid, sun-faded"
              aspect="aspect-square"
              className="w-40 -rotate-3"
            />
            <ImageSlot
              label="Pressed leaf, taped in"
              aspect="aspect-square"
              className="mt-6 w-40 rotate-2"
            />
            <ImageSlot
              label="A little drawing, hers"
              aspect="aspect-square"
              className="w-40 -rotate-1"
            />
          </div>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* OPEN QUESTIONS — the deliberately unfinished part */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-2xl">
          <Reveal>
            <p className="text-center text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Left Open, On Purpose
            </p>
            <p className="mx-auto mt-4 max-w-lg text-center text-sm opacity-50">
              This experiment doesn&apos;t answer these. It exists so
              they&apos;re not lost before anyone gets to them.
            </p>
          </Reveal>
          <div className="mt-10 flex flex-col gap-4">
            {OPEN_QUESTIONS.map((q, i) => (
              <Reveal key={q} delay={Math.min(i * 0.04, 0.3)}>
                <p className="border-l-2 border-current/20 pl-4 text-base leading-relaxed opacity-75">
                  {q}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
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
              experiment, but this one asks it more gently. Nothing here was
              meant to be finished. It was meant to be remembered.
            </p>
          </Reveal>
          <Reveal delay={0.25}>
            <Link
              href="/about/ideas-to-make-pages"
              className="mt-10 inline-flex items-center gap-1.5 rounded-full border border-current/20 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-current/5"
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
