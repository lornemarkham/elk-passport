import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ActShell, BigLine, ImageSlot, Reveal, VideoSlot } from "./components";
import {
  ATLAS_KNOWLEDGE,
  ELK_BRANDS,
  FEELING_WORDS,
  FILM_IDEAS,
  LOOSE_LINES,
  NOT_JUST_EXTREME,
  SOUND_REFERENCES,
} from "./content";

export const metadata: Metadata = {
  title: "Passport — This Is Why",
  description:
    "Not a conventional About page. The emotional heart of Passport, and why it exists.",
};

/**
 * /about — "Phase Forever."
 *
 * This is not a conventional About page and isn't trying to be one. It's
 * a living mood board for what Passport is supposed to make people feel,
 * built as a real page so it's real enough to keep coming back to — not
 * a deck that gets opened once and forgotten. See `content.ts` for
 * everything meant to keep growing (songs, films, lines, brands) and
 * `components.tsx` for the handful of primitives (`BigLine`, `Reveal`,
 * `ImageSlot`, `VideoSlot`) this whole page is built from.
 *
 * Deliberately unlike the rest of the app — different palette registers
 * (dusk/ember and paper/moss, both real theme colors, pushed harder
 * here), oversized editorial type, full-bleed sections, long scroll. Not
 * optimized for conversion. No pricing, no "book now." This is the
 * playground where the brand gets discovered, not the pitch.
 */
export default function AboutPage() {
  return (
    <main className="bg-[#f7ecd3] text-[#241a10]">
      <Link
        href="/"
        className="fixed top-4 left-4 z-50 flex items-center gap-1.5 rounded-full border border-current/15 bg-[#f7ecd3]/80 px-3 py-1.5 text-xs font-medium text-[#241a10] backdrop-blur-sm transition-opacity hover:opacity-70"
      >
        <ArrowLeft className="h-3 w-3" />
        Passport
      </Link>

      {/* ============================================================ */}
      {/* COLD OPEN */}
      {/* ============================================================ */}
      <ActShell
        tone="dark"
        className="flex min-h-[100svh] flex-col items-center justify-center px-6 text-center"
      >
        <Reveal>
          <p className="mb-6 text-xs font-medium tracking-[0.35em] uppercase opacity-50">
            Passport — Phase Forever
          </p>
          <BigLine size="massive">LIVE.</BigLine>
        </Reveal>
        <Reveal delay={0.4}>
          <p className="mt-8 max-w-md text-sm opacity-60">
            Scroll. There&apos;s no other way through this page.
          </p>
        </Reveal>
      </ActShell>

      {/* ============================================================ */}
      {/* WHY THIS EXISTS */}
      {/* ============================================================ */}
      <ActShell tone="light" className="px-6 py-32 md:py-48">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <BigLine size="large">Passport exists to help people LIVE.</BigLine>
          </Reveal>
          <Reveal delay={0.15}>
            <p className="mt-10 text-xl leading-relaxed opacity-80 md:text-2xl">
              Not browse. Not book. Not optimize.{" "}
              <span className="font-semibold">Live.</span>
            </p>
          </Reveal>
          <Reveal delay={0.3}>
            <p className="mt-8 text-lg leading-relaxed opacity-70">
              We want the product to create anticipation, wonder, excitement,
              connection, serenity, adrenaline, friendship, family, fresh air,
              music, memory — and that ridiculous feeling where you sit beside a
              fire at the end of the day and say:
            </p>
          </Reveal>
          <Reveal delay={0.45}>
            <blockquote className="mt-10 border-l-4 border-[#8a5a24]/40 pl-6">
              <BigLine size="medium">
                Holy shit. That was one hell of a day.
              </BigLine>
            </blockquote>
          </Reveal>
          <Reveal delay={0.6}>
            <p className="mt-10 text-lg opacity-70">
              That feeling is the product. Atlas is how we understand the world.
              Passport is how we turn that understanding into experiences people
              remember.
            </p>
          </Reveal>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* THE FEELING — word scatter */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-32 md:py-48">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <p className="mb-12 text-center text-xs font-medium tracking-[0.35em] uppercase opacity-50">
              Passport is
            </p>
          </Reveal>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-3">
            {FEELING_WORDS.map((word, i) => (
              <Reveal key={word} delay={i * 0.05}>
                <span
                  className="font-heading text-3xl opacity-90 md:text-5xl"
                  style={{ fontSize: `clamp(1.5rem, ${3 + (i % 4)}vw, 4rem)` }}
                >
                  {word}
                </span>
              </Reveal>
            ))}
          </div>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* ACT I — ANTICIPATION */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-32 md:py-48">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <p className="mb-8 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Act I — Anticipation
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="text-lg leading-relaxed opacity-80 md:text-xl">
              The truck is packed. Dirt bike in the back. Paddle boards tied
              down. Cooler full. Coffee in your hand. Sun barely up. Music
              already playing.
            </p>
          </Reveal>
          <Reveal delay={0.25}>
            <p className="mt-8 text-lg leading-relaxed opacity-80 md:text-xl">
              That feeling in your stomach — something good is going to happen
              today.
            </p>
          </Reveal>
          <Reveal delay={0.45}>
            <div className="mt-16">
              <BigLine size="huge">WHAT IF?</BigLine>
            </div>
          </Reveal>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* THE PRODUCT IS ANTICIPATION */}
      {/* ============================================================ */}
      <ActShell tone="light" className="px-6 py-32 md:py-48">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <BigLine size="medium">
              The adventure does not begin when you arrive.
            </BigLine>
          </Reveal>
          <Reveal delay={0.15}>
            <p className="mt-10 text-lg leading-relaxed opacity-75">
              It begins:
            </p>
            <ul className="mt-4 flex flex-col gap-2 text-lg leading-relaxed opacity-75">
              <li>when someone sends the link.</li>
              <li>when you start imagining it.</li>
              <li>when the group chat starts.</li>
              <li>when you choose the playlist.</li>
              <li>when you pack.</li>
              <li>when you check the weather.</li>
              <li>when you wake up before your alarm.</li>
            </ul>
          </Reveal>
          <Reveal delay={0.3}>
            <p className="mt-10 text-xl leading-relaxed font-medium">
              Passport should make planning feel like the first chapter of the
              experience — never a questionnaire, never something that drains
              the excitement out of discovery.
            </p>
          </Reveal>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* ACT II — THE DAY */}
      {/* ============================================================ */}
      <ActShell tone="light" className="px-6 py-32 md:py-48">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <p className="mb-8 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Act II — The Day
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <BigLine size="huge">GO.</BigLine>
          </Reveal>
          <Reveal delay={0.25}>
            <p className="mt-10 max-w-2xl text-lg leading-relaxed opacity-75">
              Windows down. Mountains ahead. Friends laughing. Near beers in the
              cooler. A road you&apos;ve never driven. A lake nobody in the
              group has seen before.
            </p>
          </Reveal>
          <div className="mt-16 grid grid-cols-2 gap-3 md:grid-cols-4">
            <ImageSlot label="Road" aspect="aspect-[3/4]" />
            <ImageSlot
              label="Mountains"
              aspect="aspect-[3/4]"
              className="mt-8"
            />
            <ImageSlot label="Friends laughing" aspect="aspect-[3/4]" />
            <ImageSlot
              label="The lake, first sight"
              aspect="aspect-[3/4]"
              className="mt-8"
            />
          </div>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* NOT JUST EXTREME ADVENTURE */}
      {/* ============================================================ */}
      <ActShell tone="light" className="px-6 py-32 md:py-48">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <BigLine size="medium">
              This is not only cliff jumps and dirt bikes.
            </BigLine>
          </Reveal>
          <Reveal delay={0.15}>
            <p className="mt-6 text-lg opacity-70">
              That&apos;s one expression of feeling alive. It can also be —
            </p>
          </Reveal>
          <div className="mt-10 flex flex-col gap-3">
            {NOT_JUST_EXTREME.map((moment, i) => (
              <Reveal key={moment.line} delay={i * 0.04}>
                <p className="text-lg leading-relaxed opacity-75 md:text-xl">
                  {moment.line}
                </p>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.3}>
            <p className="mt-12 text-lg leading-relaxed opacity-75">
              The energy changes. The purpose doesn&apos;t.
            </p>
          </Reveal>
          <Reveal delay={0.45}>
            <div className="mt-6">
              <BigLine size="large">Feel more alive.</BigLine>
            </div>
          </Reveal>
          <Reveal delay={0.6}>
            <p className="mt-12 max-w-xl text-base leading-relaxed italic opacity-60">
              Imagine a 90-year-old discovering Passport and thinking: I&apos;m
              not done. I want to go there. I want to feel that. That is as
              powerful as a cliff jump.
            </p>
          </Reveal>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* ACT III — STILLNESS */}
      {/* ============================================================ */}
      <ActShell
        tone="dark"
        className="flex min-h-[100svh] flex-col items-center justify-center px-6 py-32 text-center"
      >
        <Reveal>
          <p className="mb-8 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
            Act III — Stillness
          </p>
        </Reveal>
        <Reveal delay={0.2}>
          <BigLine size="massive">BREATHE.</BigLine>
        </Reveal>
        <Reveal delay={0.5}>
          <p className="mt-10 max-w-md text-sm opacity-50">
            Wind through trees. Footsteps. Water. Someone standing above a
            cliff. Silence.
          </p>
        </Reveal>
      </ActShell>

      {/* ============================================================ */}
      {/* SERENDIPITY */}
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
              Leave room. Passport should sometimes say:
            </p>
          </Reveal>
          <Reveal delay={0.3}>
            <blockquote className="mt-6 border-l-4 border-[#8a5a24]/40 pl-6 text-xl leading-relaxed italic opacity-80">
              You have two free hours. There&apos;s something nearby you might
              love.
            </blockquote>
          </Reveal>
          <Reveal delay={0.45}>
            <p className="mt-10 text-lg leading-relaxed opacity-75">
              The cinnamon bun. The roadside lake. The weird museum. The old
              pub. The beach you didn&apos;t know existed.
            </p>
          </Reveal>
          <Reveal delay={0.6}>
            <p className="mt-6 text-xl leading-relaxed font-medium">
              Some of the best memories can&apos;t be scheduled. Passport should
              help create the conditions for them to happen.
            </p>
          </Reveal>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* ACT IV — BOOM */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-32 md:py-48">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <p className="mb-4 text-center text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Act IV
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="text-center">
              <BigLine size="massive">BOOM.</BigLine>
            </div>
          </Reveal>
          <Reveal delay={0.3}>
            <p className="mx-auto mt-10 max-w-xl text-center text-lg leading-relaxed opacity-70">
              Music hits. Drone pulls up. Splash. Underwater. Complete silence
              again. Bubbles. Sunlight above the surface. Come up for air.
              Everyone losing their minds laughing.
            </p>
          </Reveal>
          <div className="mt-20 grid grid-cols-1 gap-6 md:grid-cols-2">
            <Reveal>
              <BigLine size="large">JUMP.</BigLine>
              <p className="mt-4 text-sm opacity-60">
                Dust. Trees flying past. Helmet cam. Engine. A hand signal.
                Stop. Take off the helmet. Nothing but wind and mountains.
              </p>
            </Reveal>
            <Reveal delay={0.15}>
              <ImageSlot label="Cliff jump, mid-air" aspect="aspect-[4/3]" />
            </Reveal>
          </div>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* PASSPORT SOUND */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-32 md:py-48">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Passport Sound
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <BigLine size="large">Music tells the story.</BigLine>
          </Reveal>
          <Reveal delay={0.25}>
            <p className="mt-8 max-w-2xl text-lg leading-relaxed opacity-70">
              Not a genre. A feeling. Music that creates anticipation, gives you
              chills, makes a memory feel bigger, makes you want to get up
              tomorrow and live again. This list is meant to keep growing —
              songs, albums, playlists, and the notes about why they belong
              here.
            </p>
          </Reveal>
          <div className="mt-14 flex flex-col divide-y divide-current/10">
            {SOUND_REFERENCES.map((ref, i) => (
              <Reveal key={ref.artist} delay={Math.min(i * 0.04, 0.4)}>
                <a
                  href={ref.searchUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex flex-col gap-1 py-4 transition-opacity hover:opacity-70 md:flex-row md:items-baseline md:justify-between md:gap-6"
                >
                  <span className="font-heading text-xl">{ref.artist}</span>
                  <span className="text-sm italic opacity-60 md:text-right">
                    {ref.territory}
                  </span>
                </a>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.3}>
            <p className="mt-10 text-sm opacity-40">
              This is not an audio-hosting exercise — no copyrighted files live
              here, just the emotional territory, and a real place to go listen.
            </p>
          </Reveal>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* FUTURE FILMS */}
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
          <Reveal delay={0.25}>
            <p className="mt-8 max-w-2xl text-lg leading-relaxed opacity-70">
              Cinematic travel films. Music videos. Product films. Personal
              adventure films. Short-form stories. Nothing below is shot yet —
              these are treatments waiting for a camera.
            </p>
          </Reveal>
          <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2">
            {FILM_IDEAS.map((film, i) => (
              <Reveal key={film.title} delay={i * 0.1}>
                <VideoSlot title={film.title} beats={film.beats} />
              </Reveal>
            ))}
          </div>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* ACT V — HOME */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-32 md:py-48">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <p className="mb-8 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Act V — Home
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="text-lg leading-relaxed opacity-80 md:text-xl">
              Quiet again. Cabin in the background. Fire is lit. Dinner is on
              the BBQ. Wet towels hanging off chairs. Dirt bikes covered in mud.
              Everyone tired.
            </p>
          </Reveal>
          <Reveal delay={0.25}>
            <p className="mt-8 text-lg leading-relaxed opacity-80 md:text-xl">
              Someone cracks a beer or near beer. Sun disappears. Firelight.
              Nobody is rushing anywhere.
            </p>
          </Reveal>
          <Reveal delay={0.45}>
            <div className="mt-16 text-center">
              <BigLine size="massive">STAY.</BigLine>
            </div>
          </Reveal>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* ALL ELK BRANDS */}
      {/* ============================================================ */}
      <ActShell tone="light" className="px-6 py-32 md:py-48">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Bigger Than Passport
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <BigLine size="medium">Different products. Same heart.</BigLine>
          </Reveal>
          <Reveal delay={0.25}>
            <p className="mt-8 max-w-2xl text-lg leading-relaxed opacity-70">
              This principle is bigger than Passport. It should influence every
              ELK product — help people live more fully.
            </p>
          </Reveal>
          <div className="mt-14 flex flex-col divide-y divide-current/10">
            {ELK_BRANDS.map((brand, i) => (
              <Reveal key={brand.name} delay={i * 0.06}>
                <div className="flex flex-col gap-1 py-5 md:flex-row md:items-baseline md:justify-between md:gap-6">
                  <span className="font-heading text-2xl">{brand.name}</span>
                  <span className="text-base opacity-60 md:text-right">
                    {brand.heart}
                  </span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* ATLAS UNDERSTANDS. PASSPORT INSPIRES. */}
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
              {ATLAS_KNOWLEDGE.map((item) => (
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
      {/* LOOSE LINES WALL */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-32 md:py-48">
        <div className="mx-auto max-w-4xl">
          <Reveal>
            <p className="mb-12 text-center text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Notebook — still filling up
            </p>
          </Reveal>
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-6">
            {LOOSE_LINES.map((line, i) => (
              <Reveal key={line} delay={Math.min(i * 0.03, 0.4)}>
                <span
                  className="font-heading opacity-80"
                  style={{
                    fontSize: `clamp(1.1rem, ${2 + (i % 5) * 0.6}vw, 3rem)`,
                  }}
                >
                  {line}
                </span>
              </Reveal>
            ))}
          </div>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* ACT VI — TOMORROW */}
      {/* ============================================================ */}
      <ActShell
        tone="dark"
        className="flex min-h-[100svh] flex-col items-center justify-center px-6 text-center"
      >
        <Reveal>
          <p className="mb-10 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
            Act VI
          </p>
        </Reveal>
        <Reveal delay={0.2}>
          <BigLine size="huge">What if we did it again tomorrow?</BigLine>
        </Reveal>
        <Reveal delay={0.6}>
          <p className="mt-16 max-w-xs text-xs leading-relaxed italic opacity-30">
            This page is not finished. It is not supposed to be. Add the image.
            Add the song. Add the line you wrote last night. — Phase Forever.
          </p>
        </Reveal>
        <Reveal delay={0.75}>
          <div className="mt-10 flex flex-col items-center gap-2">
            <Link
              href="/about/idea-atlas"
              className="text-xs font-medium tracking-[0.2em] uppercase underline decoration-current/30 underline-offset-4 opacity-40 transition-opacity hover:opacity-70"
            >
              ELK Labs — Idea Atlas →
            </Link>
            <Link
              href="/about/ideas-to-make-pages"
              className="text-xs font-medium tracking-[0.2em] uppercase underline decoration-current/30 underline-offset-4 opacity-40 transition-opacity hover:opacity-70"
            >
              ELK Labs — the ideas wall →
            </Link>
          </div>
        </Reveal>
      </ActShell>
    </main>
  );
}
