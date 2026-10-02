import type { Metadata } from "next";
import Link from "next/link";
import { octoberPool } from "@/lib/labs/october/pool";

export const metadata: Metadata = { title: "Discovery Lab — October" };

/**
 * **Three answers to one question, built on one pool.**
 *
 * The question is *"I have no freaking idea what to do tonight."* The three
 * prototypes behind this page answer it in genuinely different ways — one
 * composes an evening for you, one asks what you feel like, one deals cards
 * at you — and they read the same inventory so that what is being compared is
 * the discovery model and not the content.
 *
 * Nothing here replaces anything. October, Discover, Movies, Make and My
 * October are untouched and still the product; this is a lab.
 */
export default async function DiscoveryLabIndex() {
  const pool = await octoberPool();
  const { census } = pool;

  return (
    <main className="min-h-screen bg-[#0c0a0c] text-[#e9e6da]">
      <div className="mx-auto max-w-3xl px-5 py-16 sm:px-6">
        <p className="text-[11px] tracking-[0.22em] text-[#d09a4e] uppercase">
          Discovery Lab
        </p>
        <h1 className="font-heading mt-2 text-4xl leading-tight tracking-tight text-[#f3efe4] sm:text-5xl">
          I have no idea what to do tonight.
        </h1>
        <p className="mt-4 max-w-xl leading-relaxed text-[#e9e6da]/55">
          Three prototypes, one pool of{" "}
          <span className="text-[#e9e6da]">
            {pool.possibilities.length} possibilities
          </span>{" "}
          — {census.atlas} from Atlas, {census.movie} films, {census.doing}{" "}
          things to make. {census.tonight} of them could happen tonight.{" "}
          {census.withImage} have a picture worth showing.
        </p>

        <ul className="mt-10 flex flex-col gap-3">
          {LABS.map((lab) => (
            <li key={lab.href}>
              <Link
                href={lab.href}
                className="group block rounded-xl border border-[#e9e6da]/10 p-5 transition-colors hover:border-[#d09a4e]/45"
              >
                <p className="text-[11px] tracking-[0.2em] text-[#d09a4e] uppercase">
                  {lab.tag}
                </p>
                <h2 className="font-heading mt-1 text-2xl text-[#f3efe4]">
                  {lab.title}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-[#e9e6da]/55">
                  {lab.line}
                </p>
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-10 text-xs leading-relaxed text-[#e9e6da]/30">
          Add{" "}
          <code className="text-[#e9e6da]/50">?sim=kelowna-rainy-night</code> to
          any of these to look at a different evening. Simulation is a
          development harness, it is labelled on screen, and it never writes
          anything.
        </p>

        <Link
          href="/october"
          className="mt-8 inline-flex min-h-11 items-center text-sm text-[#e9e6da]/45 underline-offset-4 hover:underline"
        >
          ← Back to October
        </Link>
      </div>
    </main>
  );
}

const LABS = [
  {
    href: "/labs/october/discovery/a",
    tag: "Experiment A",
    title: "Tonight",
    line: "October reads the evening and writes you a front page. You scroll. It already decided what matters, and says why.",
  },
  {
    href: "/labs/october/discovery/b",
    tag: "Experiment B",
    title: "What do you feel like?",
    line: "You finish the sentence. The page becomes that sentence's answer. Includes one search box over everything.",
  },
  {
    href: "/labs/october/discovery/c",
    tag: "Experiment C",
    title: "Trust me",
    line: "Two questions, then October deals possibilities one at a time. Yes, maybe, not tonight. It learns as you go.",
  },
] as const;
