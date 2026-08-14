import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ActShell, BigLine, ImageSlot, Reveal, VideoSlot } from "../components";
import { MusicCutSection } from "./MusicCutSection";
import { RawIdeaVault } from "./RawIdeaVault";
import {
  FILM_IDEAS,
  MUSIC_CUTS,
  RAW_IDEA_VAULT,
  SOUND_WORLDS,
} from "./content";

// Deliberately no OpenGraph/description dressing, and deliberately not
// linked from any nav — this is a hidden studio page, findable only by
// URL. `robots: noindex` keeps search engines from surfacing it either.
export const metadata: Metadata = {
  title: "Passport — Vision Studio",
  robots: { index: false, follow: false },
};

const VISUAL_MOOD = [
  "road trips",
  "lakes",
  "mountains",
  "forests",
  "cabins",
  "ocean",
  "campfires",
  "paddle boards",
  "dirt bikes",
  "trucks",
  "food",
  "friends",
  "families",
  "older adults",
  "quiet solo moments",
  "underwater",
  "sunrise",
  "dusk",
  "rain",
  "snow",
  "dust",
  "mud",
  "wet hair",
  "smoke",
  "wrinkled jackets",
  "bad parking",
  "burnt marshmallows",
  "real laughter",
];

const NOT_ONLY_EXTREME = [
  "A 90-year-old finding a beautiful lakeside walk.",
  "A couple having lunch somewhere unexpected.",
  "A grandfather taking his granddaughter fishing.",
  "A quiet bookstore.",
  "A winery.",
  "A garden.",
  "A ferry ride.",
  "A beach.",
  "A perfect coffee.",
  "A family dinner.",
  "A sunset.",
];

const STORYBOARD = [
  "Early morning. Truck packed. Dirt bike in the back. Paddle boards tied down. Cooler ready. Coffee in hand. Sun barely up. Music playing. Anticipation.",
  "Drive. Windows down. Friends laughing.",
  "Cold lake. Sunshine. Someone standing above a cliff. Silence.",
  "Jump. BOOM. Underwater silence. Bubbles. Come up for air. Everyone laughing. Drone shot.",
  "Dirt bikes. Dust. Trees.",
  "Evening. Cabin in background. BBQ. Fire. Wet towels. Near beers. Stars. Quiet.",
  "“Holy shit. That was one hell of a day.”",
];

/**
 * /about/vision — the Secret Passport Creative Studio.
 *
 * Not a marketing page, not documentation. A mood board that happens to
 * run in production so it's real enough to keep coming back to.
 * Deliberately unlinked from any nav (see `metadata.robots` above) —
 * findable only by URL, on purpose, per the brief.
 *
 * Shares its visual primitives with `/about` (`../components.tsx` —
 * `Reveal`, `BigLine`, `ActShell`, `ImageSlot`, `VideoSlot`) rather than
 * duplicating them; this page's own job is different from `/about`'s —
 * `/about` performs the story, this page is the studio wall behind it:
 * music auditions, film treatments, a reference wall, and the raw vault
 * where half-formed ideas live before they're anything else. Almost
 * everything long-lived here is data in `content.ts` — adding a track,
 * a film, or a vault entry is a one-line push, never a component change.
 */
export default function VisionStudioPage() {
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
      {/* 1. OPENING */}
      {/* ============================================================ */}
      <ActShell
        tone="dark"
        className="flex min-h-[100svh] flex-col items-center justify-center gap-10 px-6 text-center"
      >
        <Reveal>
          <p className="text-xs font-medium tracking-[0.35em] uppercase opacity-40">
            Internal — Passport Creative Studio
          </p>
        </Reveal>
        {[
          "LIVE.",
          "GO.",
          "BREATHE.",
          "BOOM.",
          "STAY.",
          "LOOK UP.",
          "WHAT IF?",
          "ONE MORE.",
          "ONE HELL OF A DAY.",
        ].map((word, i) => (
          <Reveal key={word} delay={i * 0.15}>
            <BigLine
              size={i % 3 === 0 ? "massive" : i % 3 === 1 ? "huge" : "large"}
            >
              {word}
            </BigLine>
          </Reveal>
        ))}
        <Reveal delay={1.4}>
          <p className="mt-10 text-sm opacity-40">TOMORROW STARTS HERE.</p>
        </Reveal>
      </ActShell>

      {/* ============================================================ */}
      {/* 2. WHY PASSPORT EXISTS */}
      {/* ============================================================ */}
      <ActShell tone="light" className="px-6 py-32 md:py-48">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <BigLine size="large">
              Passport exists to help people create days they remember for the
              rest of their lives.
            </BigLine>
          </Reveal>
          <Reveal delay={0.15}>
            <p className="mt-10 text-xl opacity-75">
              Not transactions. Not itineraries. Memories.
            </p>
          </Reveal>
          <Reveal delay={0.3}>
            <p className="mt-6 text-lg leading-relaxed opacity-70">
              The kind where you crack a beer or near beer at the end of the day
              and say —
            </p>
          </Reveal>
          <Reveal delay={0.45}>
            <blockquote className="mt-8 border-l-4 border-[#8a5a24]/40 pl-6">
              <BigLine size="medium">
                Holy shit. That was one hell of a day.
              </BigLine>
            </blockquote>
          </Reveal>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* 3. THE PASSPORT STORY — storyboard treatment */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-32 md:py-48">
        <div className="mx-auto max-w-4xl">
          <Reveal>
            <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Storyboard — Working Treatment
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <BigLine size="large">The Passport Story</BigLine>
          </Reveal>
          <div className="mt-16 flex flex-col gap-10">
            {STORYBOARD.map((beat, i) => (
              <Reveal key={beat} delay={Math.min(i * 0.08, 0.5)}>
                <div className="flex items-start gap-6">
                  <span className="font-heading shrink-0 text-sm opacity-30">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p className="text-lg leading-relaxed opacity-80 md:text-xl">
                    {beat}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
          <div className="mt-20 grid grid-cols-2 gap-3 md:grid-cols-4">
            <ImageSlot label="Truck, dark driveway" aspect="aspect-[3/4]" />
            <ImageSlot
              label="Cliff jump"
              aspect="aspect-[3/4]"
              className="mt-8"
            />
            <ImageSlot label="Underwater, bubbles" aspect="aspect-[3/4]" />
            <ImageSlot
              label="Campfire, dusk"
              aspect="aspect-[3/4]"
              className="mt-8"
            />
          </div>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* 4. MUSIC — THE SOUND OF PASSPORT */}
      {/* ============================================================ */}
      <ActShell tone="light" className="px-6 py-32 md:py-48">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              The Sound of Passport
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <BigLine size="large">We&apos;re not choosing a genre.</BigLine>
          </Reveal>
          <Reveal delay={0.25}>
            <p className="mt-8 max-w-2xl text-lg leading-relaxed opacity-70">
              We&apos;re discovering the emotional language of Passport — six
              audition sets, each one the same five-act story (Anticipation →
              The Drive → Discovery → BOOM → Afterglow) told by a different cast
              of music. Rate what lands. Nothing here is final.
            </p>
          </Reveal>
        </div>
        <div className="mx-auto mt-20 flex max-w-4xl flex-col gap-24">
          {MUSIC_CUTS.map((cut) => (
            <MusicCutSection key={cut.slug} cut={cut} />
          ))}
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* 5. SOUND WORLDS REFERENCE WALL */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-32 md:py-48">
        <div className="mx-auto max-w-4xl">
          <Reveal>
            <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Sound Worlds — Keep Exploring
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="max-w-xl text-lg leading-relaxed opacity-60">
              An evolving reference wall, not a definitive list. Add a name the
              moment it earns its place.
            </p>
          </Reveal>
          <div className="mt-14 flex flex-wrap gap-x-6 gap-y-4">
            {SOUND_WORLDS.map((artist, i) => (
              <Reveal key={artist.name} delay={Math.min(i * 0.02, 0.4)}>
                <span
                  className="font-heading opacity-80"
                  style={{
                    fontSize: `clamp(1rem, ${1.4 + (i % 4) * 0.5}vw, 2.2rem)`,
                  }}
                >
                  {artist.name}
                </span>
              </Reveal>
            ))}
          </div>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* 6. PASSPORT FILMS WE WANT TO MAKE */}
      {/* ============================================================ */}
      <ActShell tone="light" className="px-6 py-32 md:py-48">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Passport Films
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <BigLine size="large">Films we want to make.</BigLine>
          </Reveal>
          <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2">
            {FILM_IDEAS.map((film, i) => (
              <Reveal key={film.title} delay={i * 0.08}>
                <VideoSlot title={film.title} beats={film.beats} />
              </Reveal>
            ))}
          </div>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* 7. IMAGERY / VISUAL MOOD */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-32 md:py-48">
        <div className="mx-auto max-w-4xl">
          <Reveal>
            <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Visual Mood
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="max-w-xl text-lg leading-relaxed opacity-60">
              Real life, not generic luxury travel. Dust, not polish.
            </p>
          </Reveal>
          <div className="mt-12 flex flex-wrap gap-2">
            {VISUAL_MOOD.map((word) => (
              <span
                key={word}
                className="rounded-full border border-current/15 px-3 py-1.5 text-sm opacity-70"
              >
                {word}
              </span>
            ))}
          </div>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* 8. ADVENTURE IS NOT ONLY EXTREME */}
      {/* ============================================================ */}
      <ActShell tone="light" className="px-6 py-32 md:py-48">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <BigLine size="medium">Adventure is not only extreme.</BigLine>
          </Reveal>
          <div className="mt-10 flex flex-col gap-3">
            {NOT_ONLY_EXTREME.map((line, i) => (
              <Reveal key={line} delay={Math.min(i * 0.05, 0.4)}>
                <p className="text-lg leading-relaxed opacity-75 md:text-xl">
                  {line}
                </p>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.4}>
            <p className="mt-12 text-lg opacity-70">
              The energy changes. The purpose does not.
            </p>
          </Reveal>
          <Reveal delay={0.55}>
            <div className="mt-4">
              <BigLine size="large">Feel more alive.</BigLine>
            </div>
          </Reveal>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* 9. PASSPORT PRODUCT PHILOSOPHY */}
      {/* ============================================================ */}
      <ActShell tone="light" className="px-6 py-32 md:py-48">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <BigLine size="medium">
              Atlas understands the world. Passport helps you experience it.
            </BigLine>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="mt-10 text-lg opacity-70">Atlas gathers:</p>
          </Reveal>
          <Reveal delay={0.3}>
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                "places",
                "relationships",
                "activities",
                "facilities",
                "history",
                "accessibility",
                "hours",
                "weather",
                "context",
                "sources",
              ].map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-current/15 px-3 py-1 text-sm opacity-70"
                >
                  {item}
                </span>
              ))}
            </div>
          </Reveal>
          <Reveal delay={0.45}>
            <p className="mt-10 text-2xl font-medium">
              Passport turns that into possibility.
            </p>
          </Reveal>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* 10. PLANNING IS PART OF THE ADVENTURE */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-32 md:py-48">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <BigLine size="medium">
              Planning is Chapter One, not a questionnaire.
            </BigLine>
          </Reveal>
          <Reveal delay={0.15}>
            <p className="mt-10 text-lg opacity-70">The experience begins —</p>
            <ul className="mt-4 flex flex-col gap-2 text-lg leading-relaxed opacity-75">
              <li>when someone sends the link.</li>
              <li>when the group chat starts.</li>
              <li>when you choose the playlist.</li>
              <li>when you check the weather.</li>
              <li>when you pack.</li>
              <li>when you wake before the alarm.</li>
            </ul>
          </Reveal>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* 11. SERENDIPITY */}
      {/* ============================================================ */}
      <ActShell tone="light" className="px-6 py-32 md:py-48">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <BigLine size="medium">
              Do not optimize every second of a human life.
            </BigLine>
          </Reveal>
          <Reveal delay={0.15}>
            <p className="mt-8 text-lg leading-relaxed opacity-75">
              Leave room for the unexpected. The wrong turn. The bakery. The
              roadside lake. The pub. The weird museum. The sunset stop.
            </p>
          </Reveal>
          <Reveal delay={0.3}>
            <p className="mt-6 text-xl leading-relaxed font-medium">
              Passport should help people create conditions for magic, not
              schedule every minute.
            </p>
          </Reveal>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* 12. RAW IDEA VAULT */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-32 md:py-48">
        <div className="mx-auto max-w-3xl">
          <RawIdeaVault entries={RAW_IDEA_VAULT} />
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* Closing */}
      {/* ============================================================ */}
      <ActShell
        tone="dark"
        className="flex min-h-[60svh] flex-col items-center justify-center gap-8 px-6 text-center"
      >
        <Reveal>
          <p className="max-w-xs text-xs leading-relaxed italic opacity-30">
            This page is not finished. It is not supposed to be. Add the song.
            Add the photo. Add the scene. Add the quote you wrote last night. It
            should all welcome you back.
          </p>
        </Reveal>
        <Reveal delay={0.15}>
          <Link
            href="/about/ideas-to-make-pages"
            className="text-xs font-medium tracking-[0.2em] uppercase underline decoration-current/30 underline-offset-4 opacity-40 transition-opacity hover:opacity-70"
          >
            ELK Labs — ten experiments →
          </Link>
        </Reveal>
      </ActShell>
    </main>
  );
}
