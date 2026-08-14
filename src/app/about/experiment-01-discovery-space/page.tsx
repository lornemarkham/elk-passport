import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowDown } from "lucide-react";
import { ActShell, BigLine, ImageSlot, Reveal } from "../components";
import { SKETCH_PLACES } from "./content";

export const metadata: Metadata = {
  title: "ELK Labs — Experiment 01: Discovery Space",
  robots: { index: false, follow: false },
};

/**
 * /about/experiment-01-discovery-space — the first real sandbox off the
 * ELK Labs wall (`/about/ideas-to-make-pages`).
 *
 * This is a working sketch of the *feeling* of "Discovery Space" — moving
 * through places one at a time, full-bleed, instead of scrolling a grid
 * of results — built with plain CSS scroll-snap, not a real discovery
 * engine. Every place shown here is invented (`content.ts` says so
 * directly) — the point of this page is the *motion and pacing* of moving
 * through a space, not a real recommendation. `noindex`, same as
 * `/about/vision` — this isn't for travelers, it's a prototype for the
 * people building Passport to feel, argue with, and probably throw away.
 *
 * Deliberately its own thing, not another long scroll like `/about` or
 * `/about/vision` — the wall's own brief asked for a real sandbox to
 * prototype in, not a description of one.
 */
export default function DiscoverySpaceExperimentPage() {
  return (
    <main className="bg-[#171208] text-[#f3ead9]">
      <Link
        href="/about/ideas-to-make-pages"
        className="fixed top-4 left-4 z-50 flex items-center gap-1.5 rounded-full border border-current/15 bg-[#171208]/80 px-3 py-1.5 text-xs font-medium backdrop-blur-sm transition-opacity hover:opacity-70"
      >
        <ArrowLeft className="h-3 w-3" />
        ELK Labs
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
            Experiment 01 — Live Sandbox
          </p>
          <BigLine size="huge">DISCOVERY SPACE.</BigLine>
        </Reveal>
        <Reveal delay={0.35}>
          <p className="mt-8 max-w-md text-sm opacity-60">
            What if finding somewhere to go felt like walking in, not filtering
            a list?
          </p>
        </Reveal>
        <Reveal delay={0.55}>
          <p className="mt-10 max-w-sm text-xs leading-relaxed italic opacity-40">
            Everything below is sketch data — invented for this prototype, not
            real Atlas places. This page is about motion and pacing, not a real
            recommendation.
          </p>
        </Reveal>
        <Reveal delay={0.75}>
          <div className="mt-14 flex flex-col items-center gap-2 opacity-50">
            <span className="text-xs tracking-[0.2em] uppercase">
              Scroll to walk through
            </span>
            <ArrowDown className="h-4 w-4 animate-bounce" />
          </div>
        </Reveal>
      </ActShell>

      {/* ============================================================ */}
      {/* THE SPACE — horizontal snap-scroll, one place at a time */}
      {/* ============================================================ */}
      <div className="border-y border-current/10 bg-[#100c06]">
        <div className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth">
          {SKETCH_PLACES.map((place, i) => (
            <section
              key={place.id}
              className="flex w-screen shrink-0 snap-center flex-col items-center justify-center gap-8 px-6 py-24 md:py-32"
            >
              <span className="font-heading text-sm opacity-30">
                {String(i + 1).padStart(2, "0")} /{" "}
                {String(SKETCH_PLACES.length).padStart(2, "0")}
              </span>
              <div className="w-full max-w-md">
                <ImageSlot label={place.name} aspect="aspect-[4/5]" />
              </div>
              <div className="max-w-md text-center">
                <p className="font-heading text-3xl tracking-tight md:text-4xl">
                  {place.name}
                </p>
                <p className="mt-3 text-sm italic opacity-50">{place.mood}</p>
                <p className="mt-5 text-base leading-relaxed opacity-75">
                  {place.line}
                </p>
              </div>
            </section>
          ))}
        </div>
        <p className="pb-10 text-center text-xs tracking-[0.2em] uppercase opacity-30">
          Scroll sideways within this strip — that&apos;s the whole prototype
        </p>
      </div>

      {/* ============================================================ */}
      {/* NOTES — what's real, what's not, open questions from this build */}
      {/* ============================================================ */}
      <ActShell tone="light" className="px-6 py-32 md:py-48">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Sandbox Notes
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <BigLine size="medium">
              What this proves. What it doesn&apos;t.
            </BigLine>
          </Reveal>
          <Reveal delay={0.25}>
            <div className="mt-10 flex flex-col gap-8">
              <div>
                <p className="text-sm font-semibold opacity-60">
                  What&apos;s real here
                </p>
                <p className="mt-2 text-base leading-relaxed opacity-80">
                  The mechanic — full-bleed, one place at a time, moved through
                  by scrolling sideways instead of filtering down. That pacing
                  is the actual experiment.
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold opacity-60">
                  What&apos;s not real yet
                </p>
                <p className="mt-2 text-base leading-relaxed opacity-80">
                  Every place, photo, and line above is invented for this
                  sandbox. No Atlas data, no real photos, no ambient sound
                  (Experiment 02&apos;s job). Wiring this to real places is a
                  separate, later decision.
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold opacity-60">
                  Open questions this raised
                </p>
                <ul className="mt-2 flex flex-col gap-1.5 text-base leading-relaxed opacity-80">
                  <li>
                    Does this hold up with six real places, or does it need
                    thirty before it feels alive?
                  </li>
                  <li>
                    Is sideways scroll intuitive on first touch, or does it need
                    an explicit hint every time?
                  </li>
                  <li>
                    Where does someone go if they want to stop wandering and
                    just search for something specific?
                  </li>
                </ul>
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.4}>
            <p className="mt-14 text-sm opacity-50">
              A second Experiment 01 sandbox exists, testing a completely
              different angle — joy as a design constraint, tested against one
              deliberately extreme persona instead of pacing.
            </p>
            <Link
              href="/about/experiment-01-bachelor-party"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium underline decoration-current/30 underline-offset-4 hover:decoration-current"
            >
              HELL YEAH — The Bachelor Party Experiment →
            </Link>
          </Reveal>
          <Reveal delay={0.5}>
            <Link
              href="/about/ideas-to-make-pages"
              className="mt-8 inline-flex items-center gap-1.5 rounded-full border border-current/20 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-current/5"
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
