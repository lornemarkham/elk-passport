"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { ActShell, BigLine, ImageSlot, Reveal } from "../components";
import {
  ARTIFACTS,
  LEARN_THEMES,
  OPEN_QUESTIONS,
  PREP_ITEMS,
  SIGNAL_EXAMPLES,
  STATUS_LABEL,
} from "./content";

/**
 * Experiment 06 — "Analog Adventures."
 *
 * The quietest sandbox yet, deliberately. The philosophy it explores is
 * the one most in tension with building an app: **the best session ends
 * with the phone in a pocket.** So there's no camera, no soundscape, no
 * ambient motion — the one real interaction is packing, which is the last
 * thing you do before leaving, and the page ends by telling you to stop
 * reading it.
 *
 * The honest part of the sketch is the status on each prep item. Roughly
 * half of a genuinely useful Saturday-morning list is knowledge Atlas has
 * no way to hold — either temporal (ADR 018) or a source category that
 * doesn't exist. Showing that plainly is more useful than a mockup where
 * everything is already solved.
 */
export function AnalogAdventuresExperiment() {
  const [packed, setPacked] = useState<Set<string>>(new Set());

  const ready = useMemo(() => {
    const holdable = PREP_ITEMS.filter((i) => i.status === "atlas-could-hold");
    return {
      packedCount: packed.size,
      total: PREP_ITEMS.length,
      holdable: holdable.length,
    };
  }, [packed]);

  function togglePacked(id: string) {
    setPacked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <main className="bg-[#efe7dc] text-[#22201c]">
      <Link
        href="/about/ideas-to-make-pages"
        className="fixed top-4 left-4 z-50 flex items-center gap-1.5 rounded-full border border-current/15 bg-[#efe7dc]/80 px-3 py-1.5 text-xs font-medium backdrop-blur-sm transition-opacity hover:opacity-70"
      >
        <ArrowLeft className="h-3 w-3" />
        ELK Labs
      </Link>

      {/* ============================================================
          The thesis
          ============================================================ */}
      <ActShell tone="light" className="min-h-[85vh] flex-col justify-center">
        <Reveal>
          <p className="text-xs font-medium tracking-[0.2em] uppercase opacity-50">
            Experiment 06
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <BigLine className="mt-6">Analog Adventures</BigLine>
        </Reveal>
        <Reveal delay={0.2}>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed opacity-70">
            Technology should encourage people to spend more time living in the
            real world — not more time looking at screens.
          </p>
        </Reveal>
        <Reveal delay={0.3}>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed">
            <span className="font-medium">
              The best Passport session ends with the phone being put away.
            </span>{" "}
            Technology removes uncertainty. Then it disappears.
          </p>
        </Reveal>
        <Reveal delay={0.45}>
          <p className="mt-10 max-w-md text-sm leading-relaxed italic opacity-40">
            Which makes this page slightly absurd, and it knows it. Everything
            below is what you&apos;d do <em>before</em> leaving.
          </p>
        </Reveal>
      </ActShell>

      {/* ============================================================
          Saturday mission — the one real interaction
          ============================================================ */}
      <ActShell tone="dark">
        <Reveal>
          <p className="text-xs font-medium tracking-[0.2em] uppercase opacity-50">
            Saturday mission
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <BigLine size="large" className="mt-4">
            Sugar Lake FSR
          </BigLine>
        </Reveal>
        <Reveal delay={0.2}>
          <p className="mt-5 max-w-xl text-base leading-relaxed opacity-70">
            Passport prepares everything, once, while you still have signal.
            Tick it off as you pack.
          </p>
        </Reveal>

        <Reveal delay={0.3}>
          <ul className="mt-10 grid gap-2 sm:grid-cols-2">
            {PREP_ITEMS.map((item) => {
              const isPacked = packed.has(item.id);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => togglePacked(item.id)}
                    aria-pressed={isPacked}
                    className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition ${
                      isPacked
                        ? "border-current/40 bg-current/[0.07]"
                        : "border-current/15 hover:border-current/30"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                        isPacked
                          ? "border-current bg-current/20"
                          : "border-current/30"
                      }`}
                    >
                      {isPacked && <Check className="h-3 w-3" />}
                    </span>
                    <span className="min-w-0">
                      <span
                        className={`block text-sm font-medium ${isPacked ? "" : ""}`}
                      >
                        {item.label}
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed opacity-55">
                        {item.note}
                      </span>
                      {/* The honest part. Half of a genuinely useful list is
                          knowledge Atlas has no way to hold yet. */}
                      <span className="mt-1.5 block text-[11px] opacity-35">
                        {STATUS_LABEL[item.status]}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Reveal>

        <Reveal delay={0.4}>
          <p className="mt-8 text-sm opacity-50">
            {ready.packedCount === 0
              ? `Only ${ready.holdable} of these ${ready.total} are things Atlas could hold today. The rest are honest gaps.`
              : ready.packedCount === ready.total
                ? "That's everything. Now put the phone away."
                : `${ready.packedCount} of ${ready.total} packed.`}
          </p>
        </Reveal>
      </ActShell>

      {/* ============================================================
          Then it disappears
          ============================================================ */}
      <ActShell tone="light" className="min-h-[70vh] flex-col justify-center">
        <Reveal>
          <BigLine>Then put the phone away.</BigLine>
        </Reveal>
        <Reveal delay={0.2}>
          <p className="mt-8 max-w-xl text-lg leading-relaxed opacity-70">
            Passport&apos;s job is finished. Everything you need is on the
            device, on paper, or in your head. The rest of the day belongs to
            the road.
          </p>
        </Reveal>
        <Reveal delay={0.35}>
          <div className="mt-12 max-w-lg">
            <ImageSlot
              label="A truck, a dust cloud, a forest service road at 7am"
              aspect="aspect-[3/2]"
            />
          </div>
        </Reveal>
      </ActShell>

      {/* ============================================================
          Learn while living
          ============================================================ */}
      <ActShell tone="light">
        <Reveal>
          <p className="text-xs font-medium tracking-[0.2em] uppercase opacity-50">
            Learn while living
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <BigLine size="large" className="mt-4">
            Every adventure should quietly teach something.
          </BigLine>
        </Reveal>
        <Reveal delay={0.2}>
          <p className="mt-5 max-w-xl text-base leading-relaxed opacity-65">
            Not a lesson. A noticing. The decision this changes isn&apos;t where
            you go — it&apos;s what you see when you get there.
          </p>
        </Reveal>
        <Reveal delay={0.3}>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {LEARN_THEMES.map((theme) => (
              <div
                key={theme.title}
                className="rounded-xl border border-current/12 p-5"
              >
                <p className="text-2xl">{theme.emoji}</p>
                <p className="mt-3 text-sm font-medium">{theme.title}</p>
                <p className="mt-1 text-xs leading-relaxed opacity-55">
                  {theme.line}
                </p>
              </div>
            ))}
          </div>
        </Reveal>
      </ActShell>

      {/* ============================================================
          Physical artifacts
          ============================================================ */}
      <ActShell tone="dark">
        <Reveal>
          <p className="text-xs font-medium tracking-[0.2em] uppercase opacity-50">
            Analog enhancements
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <BigLine size="large" className="mt-4">
            Technology should create physical things.
          </BigLine>
        </Reveal>
        <Reveal delay={0.2}>
          <p className="mt-5 max-w-xl text-base leading-relaxed opacity-65">
            Paper outlasts battery. A book on a shelf outlasts an account. These
            are the artifacts a family keeps.
          </p>
        </Reveal>
        <Reveal delay={0.3}>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {ARTIFACTS.map((artifact) => (
              <div
                key={artifact.title}
                className="rounded-xl border border-current/15 p-5"
              >
                <p className="text-2xl">{artifact.emoji}</p>
                <p className="mt-3 text-sm font-medium">{artifact.title}</p>
                <p className="mt-1 text-xs leading-relaxed opacity-55">
                  {artifact.line}
                </p>
              </div>
            ))}
          </div>
        </Reveal>
      </ActShell>

      {/* ============================================================
          Signals, not reviews
          ============================================================ */}
      <ActShell tone="light">
        <Reveal>
          <p className="text-xs font-medium tracking-[0.2em] uppercase opacity-50">
            Community knowledge
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <BigLine size="large" className="mt-4">
            Not reviews. Signals.
          </BigLine>
        </Reveal>
        <Reveal delay={0.2}>
          <p className="mt-5 max-w-2xl text-base leading-relaxed opacity-65">
            A review is one person&apos;s verdict, averaged into
            meaninglessness. A signal is something several people noticed
            independently — treated as evidence, never as truth, and trusted
            only once it keeps recurring.
          </p>
        </Reveal>
        <Reveal delay={0.3}>
          <div className="mt-10 flex flex-wrap gap-2">
            {SIGNAL_EXAMPLES.map((signal) => (
              <div
                key={signal.phrase}
                className="rounded-full border border-current/15 px-4 py-2"
              >
                <span className="text-sm font-medium">
                  &ldquo;{signal.phrase}&rdquo;
                </span>
                <span className="ml-2 text-xs opacity-45">{signal.why}</span>
              </div>
            ))}
          </div>
        </Reveal>
        <Reveal delay={0.4}>
          <p className="mt-8 max-w-xl text-sm leading-relaxed opacity-45">
            Passport is deliberately not a review platform. The absence of star
            ratings is the point, not a gap.
          </p>
        </Reveal>
      </ActShell>

      {/* ============================================================
          Open questions
          ============================================================ */}
      <ActShell tone="light">
        <Reveal>
          <p className="text-xs font-medium tracking-[0.2em] uppercase opacity-50">
            Still open
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <BigLine size="large" className="mt-4">
            What this sketch raised and didn&apos;t answer.
          </BigLine>
        </Reveal>
        <Reveal delay={0.2}>
          <ul className="mt-10 flex max-w-3xl flex-col gap-6">
            {OPEN_QUESTIONS.map((item) => (
              <li
                key={item.question}
                className="border-l-2 border-current/15 pl-5"
              >
                <p className="text-base leading-relaxed font-medium">
                  {item.question}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed opacity-55">
                  {item.note}
                </p>
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={0.35}>
          <p className="mt-14 max-w-xs text-xs leading-relaxed italic opacity-30">
            A sketchbook, not a product. The Sugar Lake mission is invented —
            Atlas holds none of it yet. — ELK Labs
          </p>
        </Reveal>
      </ActShell>
    </main>
  );
}
