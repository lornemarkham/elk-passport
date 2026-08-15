import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { ActShell, BigLine, Reveal } from "../components";
import { ExperimentCard } from "./ExperimentCard";
import { EXPERIMENTS } from "./content";

export const metadata: Metadata = {
  title: "ELK Labs — Ideas To Make Pages",
  description:
    "Ten experiments in what Passport could become. A creative wall, not a product spec.",
};

/**
 * /about/ideas-to-make-pages — ELK Labs.
 *
 * Not documentation. Not a roadmap. A wall you walk past — ten concept
 * cards, each closed by default, each one an experiment in what Passport
 * could feel like rather than a commitment to build it. Shares its
 * visual primitives with `/about` and `/about/vision` (`../components`)
 * on purpose: same family, different room — this is the studio's actual
 * project wall, where `/about/vision` is more like its mood board.
 *
 * Everything long-lived here is data (`content.ts`) rendered by one
 * component (`ExperimentCard.tsx`) — adding an eleventh experiment is a
 * content push, never a page change. See `docs/content-model/future.md`
 * for the pattern note, and `docs/future/future-passport-experience.md`
 * for where an idea from this wall gets recorded once it's more than a
 * sketch — this page is intentionally not that record.
 */
export default function IdeasToMakePagesPage() {
  return (
    <main className="bg-[#f7ecd3] text-[#241a10]">
      <Link
        href="/about"
        className="fixed top-4 left-4 z-50 flex items-center gap-1.5 rounded-full border border-current/15 bg-[#f7ecd3]/80 px-3 py-1.5 text-xs font-medium text-[#241a10] backdrop-blur-sm transition-opacity hover:opacity-70"
      >
        <ArrowLeft className="h-3 w-3" />
        About
      </Link>

      {/* ============================================================ */}
      {/* OPENING */}
      {/* ============================================================ */}
      <ActShell
        tone="dark"
        className="flex min-h-[100svh] flex-col items-center justify-center px-6 text-center"
      >
        <Reveal>
          <p className="mb-6 text-xs font-medium tracking-[0.35em] uppercase opacity-50">
            ELK Labs
          </p>
          <BigLine size="massive">IDEAS.</BigLine>
        </Reveal>
        <Reveal delay={0.4}>
          <p className="mt-8 max-w-md text-sm opacity-60">
            Ten experiments. Nothing here is approved, scoped, or promised. This
            is the wall, not the plan.
          </p>
        </Reveal>
        <Reveal delay={0.6}>
          <Link
            href="/about/idea-atlas"
            className="mt-10 flex items-center gap-1.5 rounded-full border border-current/20 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-current/10"
          >
            The master wall — Idea Atlas
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </Reveal>
      </ActShell>

      {/* ============================================================ */}
      {/* WHAT THIS WALL IS */}
      {/* ============================================================ */}
      <ActShell tone="light" className="px-6 py-32 md:py-48">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <BigLine size="medium">
              Passport is being invented, not just engineered.
            </BigLine>
          </Reveal>
          <Reveal delay={0.15}>
            <p className="mt-10 text-lg leading-relaxed opacity-75">
              This is what it looks like when a place like IDEO, Pixar, or a
              game studio is still figuring out what the thing is. Sketches.
              Questions nobody&apos;s answered yet. Ideas we&apos;d throw away
              in a week if they turned out to be wrong.
            </p>
          </Reveal>
          <Reveal delay={0.3}>
            <p className="mt-6 text-lg leading-relaxed opacity-75">
              Ten cards. Each one closed until you open it. Each one honest
              about what it is and isn&apos;t yet.
            </p>
          </Reveal>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* THE WALL */}
      {/* ============================================================ */}
      <ActShell tone="light" className="px-6 pb-32 md:pb-48">
        <div className="mx-auto flex max-w-5xl flex-col gap-10">
          {EXPERIMENTS.map((experiment, i) => (
            <Reveal key={experiment.slug} delay={Math.min(i * 0.03, 0.25)}>
              <ExperimentCard experiment={experiment} reverse={i % 2 === 1} />
            </Reveal>
          ))}
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* CLOSING */}
      {/* ============================================================ */}
      <ActShell
        tone="dark"
        className="flex min-h-[70svh] flex-col items-center justify-center gap-8 px-6 text-center"
      >
        <Reveal>
          <BigLine size="huge">Go build one.</BigLine>
        </Reveal>
        <Reveal delay={0.25}>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/about/experiment-01-discovery-space"
              className="flex items-center gap-1.5 rounded-full border border-current/20 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-current/10"
            >
              Experiment 01 — Discovery Space
              <ArrowUpRight className="h-4 w-4" />
            </Link>
            <Link
              href="/about/experiment-01-bachelor-party"
              className="flex items-center gap-1.5 rounded-full border border-current/20 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-current/10"
            >
              Experiment 01B — HELL YEAH
              <ArrowUpRight className="h-4 w-4" />
            </Link>
            <Link
              href="/about/experiment-02-discovery-swipe"
              className="flex items-center gap-1.5 rounded-full border border-current/20 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-current/10"
            >
              Experiment 02 — Discovery Swipe
              <ArrowUpRight className="h-4 w-4" />
            </Link>
            <Link
              href="/about/experiment-03-october-passport"
              className="flex items-center gap-1.5 rounded-full border border-current/20 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-current/10"
            >
              Experiment 03 — October Passport
              <ArrowUpRight className="h-4 w-4" />
            </Link>
            <Link
              href="/about/experiment-04-wonder"
              className="flex items-center gap-1.5 rounded-full border border-current/20 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-current/10"
            >
              Experiment 04 — Wonder
              <ArrowUpRight className="h-4 w-4" />
            </Link>
            <Link
              href="/about/experiment-05-christmas"
              className="flex items-center gap-1.5 rounded-full border border-current/20 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-current/10"
            >
              Experiment 05 — Christmas Passport
              <ArrowUpRight className="h-4 w-4" />
            </Link>
            <Link
              href="/about/experiment-06-analog-adventures"
              className="flex items-center gap-1.5 rounded-full border border-current/20 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-current/10"
            >
              Experiment 06 — Analog Adventures
              <ArrowUpRight className="h-4 w-4" />
            </Link>
            <Link
              href="/about/experiment-07-fishing-with-emi"
              className="flex items-center gap-1.5 rounded-full border border-current/20 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-current/10"
            >
              Experiment 07 — Fishing With Emi
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </Reveal>
        <Reveal delay={0.45}>
          <p className="mt-6 max-w-xs text-xs leading-relaxed italic opacity-30">
            This wall is not finished. It is not supposed to be. Add the
            eleventh card. — ELK Labs
          </p>
        </Reveal>
      </ActShell>
    </main>
  );
}
