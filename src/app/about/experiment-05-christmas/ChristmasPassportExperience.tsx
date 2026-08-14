"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Volume2, VolumeX } from "lucide-react";
import { ActShell, BigLine, Reveal } from "../components";
import { SnowLayer } from "./SnowLayer";
import { useFireplaceSound } from "./useFireplaceSound";
import {
  ATLAS_DISCOVERY_CHIPS,
  ATLAS_PROVIDES,
  CHRISTMAS_CHALLENGE_LIST,
  CHRISTMAS_MOODS,
  CHRISTMAS_MOVIES,
  CHRISTMAS_WEATHER,
  COUNTDOWN_EXAMPLE_EVENTS,
  CRAFT_CHIPS,
  DAY_LABELS,
  ENDING_DISCLOSURE,
  ENDING_FINAL_LINE,
  ENDING_LINE,
  FAMILY_MEMORY_DISCLOSURE,
  FAMILY_MEMORY_LINES,
  GIVING_CHIPS,
  GIVING_LINE,
  LAB_NOTES_LINE,
  LITTLE_MOMENT_CHIPS,
  PASSPORT_CREATES,
  PHOTO_MOMENT_CHIPS,
  PRINCIPLES_CLOSING_LINE,
  SOUND_CHIPS,
  SOUND_DESIGN_NOTE,
  WONDER_METER_EXTRA_IDEAS,
} from "./content";

/** Real, computed live from today's actual date — not a hardcoded placeholder, same discipline as Christmas Passport's original prototype and every other real countdown in this app. */
function daysUntilChristmas(now: Date): number {
  const year =
    now.getMonth() === 11 && now.getDate() > 25
      ? now.getFullYear() + 1
      : now.getFullYear();
  const christmas = new Date(year, 11, 25);
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.ceil((christmas.getTime() - now.getTime()) / msPerDay);
}

/**
 * Experiment 05 — "Christmas Passport." Ported from the original
 * standalone `christmas-passport.html` prototype (Phase 7.15) into a real
 * Next.js route, matching every other ELK Labs sandbox's structure and
 * URL shape (`/about/experiment-05-christmas`, not a `public/` static
 * file) — the request that triggered this port was simple and correct:
 * every other experiment lives at a URL like this one, and this one
 * should too, not off in `/labs/...` unlinked from the rest of the site.
 *
 * Every real interaction from the original is preserved: mood → day plan,
 * a real Wonder Meter that grows and shrinks with real interactions, a
 * checklist of Christmas Challenges, a Movie Engine, a Weather Engine, a
 * real live countdown to Christmas, and an optional real synthesized
 * fireplace ambience (`useFireplaceSound`). Real snowfall
 * (`SnowLayer`) replaces the original's vanilla-JS version, same visual,
 * proper deterministic React this time.
 */
export function ChristmasPassportExperience() {
  const [activeMoodId, setActiveMoodId] = useState(CHRISTMAS_MOODS[0]!.id);
  const [wonder, setWonder] = useState(0);
  const [doneChallenges, setDoneChallenges] = useState<Set<string>>(new Set());
  const [activeMovie, setActiveMovie] = useState<string | null>(null);
  const [activeWeatherId, setActiveWeatherId] = useState(
    CHRISTMAS_WEATHER[0]!.id,
  );
  const [days, setDays] = useState<number | null>(null);

  const sound = useFireplaceSound();
  const activeMood = CHRISTMAS_MOODS.find((m) => m.id === activeMoodId)!;
  const activeWeather = CHRISTMAS_WEATHER.find(
    (w) => w.id === activeWeatherId,
  )!;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading today's real date after mount is the sync itself, same legitimate case as every other real countdown in this project
    setDays(daysUntilChristmas(new Date()));
  }, []);

  function addWonder(amount: number) {
    setWonder((w) => Math.max(0, Math.min(100, w + amount)));
  }

  function toggleChallenge(text: string) {
    setDoneChallenges((prev) => {
      const next = new Set(prev);
      if (next.has(text)) {
        next.delete(text);
        addWonder(-4);
      } else {
        next.add(text);
        addWonder(4);
      }
      return next;
    });
  }

  return (
    <main className="relative bg-[#0f1f16] text-[#faf6ed]">
      <SnowLayer />

      <Link
        href="/about/ideas-to-make-pages"
        className="fixed top-4 left-4 z-50 flex items-center gap-1.5 rounded-full border border-current/15 bg-[#0f1f16]/80 px-3 py-1.5 text-xs font-medium backdrop-blur-sm transition-opacity hover:opacity-70"
      >
        <ArrowLeft className="h-3 w-3" />
        ELK Labs
      </Link>

      <button
        type="button"
        onClick={sound.toggle}
        className="fixed top-4 right-4 z-50 flex items-center gap-1.5 rounded-full border border-current/15 bg-[#0f1f16]/80 px-3 py-1.5 text-xs font-medium backdrop-blur-sm transition-opacity hover:opacity-70"
      >
        {sound.on ? (
          <Volume2 className="h-3 w-3" />
        ) : (
          <VolumeX className="h-3 w-3" />
        )}
        Sound {sound.on ? "On" : "Off"}
      </button>

      {/* ============================================================ */}
      {/* INTRO */}
      {/* ============================================================ */}
      <ActShell
        tone="dark"
        className="relative flex min-h-[100svh] flex-col items-center justify-center px-6 text-center"
      >
        <style>{`
          @keyframes christmas-fire-flicker {
            0%, 100% { opacity: 0.9; } 30% { opacity: 0.6; } 55% { opacity: 1; } 80% { opacity: 0.7; }
          }
        `}</style>
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[45%]"
          style={{
            background:
              "radial-gradient(ellipse at 50% 100%, rgba(184,65,43,0.28), transparent 70%)",
            animation: "christmas-fire-flicker 3.2s ease-in-out infinite",
          }}
        />
        <Reveal>
          <p className="mb-6 text-xs font-medium tracking-[0.35em] uppercase opacity-50">
            ELK Labs — Experiment 05
          </p>
          <BigLine size="massive">CHRISTMAS.</BigLine>
        </Reveal>
        <Reveal delay={0.35}>
          <p className="mt-8 max-w-xl text-lg opacity-70">
            This is not a Christmas website. Not shopping. Not Black Friday.
            Passport&apos;s emotional interpretation of the season.
          </p>
        </Reveal>
        <Reveal delay={0.6}>
          <p className="font-heading mt-10 max-w-md text-2xl italic opacity-85">
            &ldquo;Some memories deserve to happen every year.&rdquo;
          </p>
        </Reveal>
      </ActShell>

      {/* ============================================================ */}
      {/* CHOOSE YOUR CHRISTMAS */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-5xl text-center">
          <Reveal>
            <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Choose Your Christmas
            </p>
            <BigLine size="medium">Not personalities. Moods.</BigLine>
            <p className="mx-auto mt-4 max-w-lg text-base opacity-60">
              Pick one — the day below changes with it.
            </p>
          </Reveal>
          <div className="mt-12 grid grid-cols-1 gap-3 text-left sm:grid-cols-2 lg:grid-cols-3">
            {CHRISTMAS_MOODS.map((mood, i) => (
              <Reveal key={mood.id} delay={Math.min(i * 0.03, 0.3)}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveMoodId(mood.id);
                    addWonder(6);
                  }}
                  className={`flex w-full flex-col gap-1.5 rounded-2xl border p-5 transition-colors ${
                    activeMoodId === mood.id
                      ? "border-[#c9a15a] bg-[#c9a15a]/10"
                      : "border-current/15 hover:border-current/30"
                  }`}
                >
                  <span className="text-2xl">{mood.emoji}</span>
                  <span className="font-heading text-lg">{mood.name}</span>
                </button>
              </Reveal>
            ))}
          </div>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* BUILD MY DAY */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Build My Day
            </p>
            <BigLine size="medium">
              Passport, building the perfect day, like a director.
            </BigLine>
          </Reveal>
          <div className="mt-10 flex flex-col gap-5 text-left">
            {activeMood.day.map((line, i) => (
              <div key={line} className="flex items-baseline gap-4">
                <span className="font-heading w-24 shrink-0 text-sm opacity-40">
                  {DAY_LABELS[i]}
                </span>
                <span className="opacity-85">{line}</span>
              </div>
            ))}
          </div>
          <Reveal delay={0.15}>
            <p className="mx-auto mt-8 max-w-md text-xs italic opacity-40">
              Invented, illustrative content — not real Atlas inventory, same as
              every ELK Labs sandbox. Changes with the mood you picked above.
            </p>
          </Reveal>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* CHRISTMAS CHALLENGES */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-xl text-center">
          <Reveal>
            <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Christmas Challenges
            </p>
            <BigLine size="medium">
              Not achievements. Joy, with a checklist.
            </BigLine>
            <p className="mx-auto mt-4 max-w-md text-base opacity-60">
              Check them off as you go. The Wonder Meter grows with every one.
            </p>
          </Reveal>
          <div className="mt-10 flex flex-col gap-2">
            {CHRISTMAS_CHALLENGE_LIST.map((text) => {
              const done = doneChallenges.has(text);
              return (
                <button
                  key={text}
                  type="button"
                  onClick={() => toggleChallenge(text)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                    done
                      ? "border-[#c9a15a] line-through opacity-50"
                      : "border-current/15 hover:border-current/30"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs ${
                      done
                        ? "border-[#c9a15a] bg-[#c9a15a] text-[#0a1610]"
                        : "border-current/30"
                    }`}
                  >
                    {done ? "✓" : ""}
                  </span>
                  <span>{text}</span>
                </button>
              );
            })}
          </div>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* THE WONDER METER */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-24 text-center">
        <div className="mx-auto max-w-lg">
          <Reveal>
            <p className="text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              The Wonder Meter
            </p>
            <p className="mt-1 text-sm opacity-50">
              Not a progress bar. Wonder.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="font-heading mt-4 text-6xl">✨ {wonder}%</p>
          </Reveal>
          <div className="mx-auto mt-4 h-2.5 max-w-md overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#c9a15a] to-[#e0bd7d] transition-[width] duration-500"
              style={{ width: `${wonder}%` }}
            />
          </div>
          <Reveal delay={0.2}>
            <p className="mt-8 text-base opacity-60">Try one of these too:</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {WONDER_METER_EXTRA_IDEAS.map((idea) => (
                <span
                  key={idea}
                  className="rounded-full border border-current/20 px-3 py-1.5 text-sm opacity-70"
                >
                  {idea}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* ATLAS DISCOVERY */}
      {/* ============================================================ */}
      <ActShell tone="light" className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-4xl text-center">
          <Reveal>
            <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Atlas Discovery
            </p>
            <BigLine size="medium">
              Atlas provides truth. Passport provides meaning.
            </BigLine>
            <p className="mx-auto mt-4 max-w-xl text-base opacity-60">
              The real kinds of knowledge this would draw on — most of it not
              built yet, named honestly.
            </p>
          </Reveal>
          <div className="mt-10 flex flex-wrap justify-center gap-2">
            {ATLAS_DISCOVERY_CHIPS.map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-current/20 px-3 py-1.5 text-sm opacity-70"
              >
                {chip}
              </span>
            ))}
          </div>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* THE MOVIE ENGINE */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-4xl text-center">
          <Reveal>
            <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              The Movie Engine
            </p>
            <BigLine size="medium">
              &ldquo;What kind of Christmas movie are you living today?&rdquo;
            </BigLine>
          </Reveal>
          <div className="mt-10 grid grid-cols-1 gap-3 text-left sm:grid-cols-2 lg:grid-cols-3">
            {CHRISTMAS_MOVIES.map((movie) => (
              <button
                key={movie.name}
                type="button"
                onClick={() => {
                  setActiveMovie(movie.name);
                  addWonder(5);
                }}
                className={`rounded-2xl border p-5 transition-colors ${
                  activeMovie === movie.name
                    ? "border-[#c9a15a] bg-[#c9a15a]/10"
                    : "border-current/15 hover:border-current/30"
                }`}
              >
                <span className="font-heading text-base">{movie.name}</span>
              </button>
            ))}
          </div>
          <p className="mt-8 min-h-[1.5em] text-base italic opacity-80">
            {activeMovie
              ? CHRISTMAS_MOVIES.find((m) => m.name === activeMovie)?.tags
              : ""}
          </p>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* FAMILY MEMORY */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-xl text-center">
          <Reveal>
            <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Family Memory — Prototype
            </p>
            <BigLine size="medium">Passport remembers traditions.</BigLine>
          </Reveal>
          <div className="mt-8 flex flex-col gap-3">
            {FAMILY_MEMORY_LINES.map((line) => (
              <p key={line} className="text-lg italic opacity-75">
                &ldquo;{line}&rdquo;
              </p>
            ))}
          </div>
          <Reveal delay={0.15}>
            <p className="mx-auto mt-6 max-w-md text-xs italic opacity-40">
              {FAMILY_MEMORY_DISCLOSURE}
            </p>
          </Reveal>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* THE WEATHER ENGINE */}
      {/* ============================================================ */}
      <ActShell tone="light" className="px-6 py-24 text-center">
        <div className="mx-auto max-w-lg">
          <Reveal>
            <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              The Weather Engine
            </p>
            <BigLine size="medium">Weather becomes magic.</BigLine>
          </Reveal>
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {CHRISTMAS_WEATHER.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => {
                  setActiveWeatherId(w.id);
                  addWonder(3);
                }}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  activeWeatherId === w.id
                    ? "border-[#c9a15a] bg-[#c9a15a]/15"
                    : "border-current/20 opacity-70 hover:opacity-100"
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>
          <p className="mt-6 text-base italic opacity-70">
            {activeWeather.line}
          </p>
          <Reveal delay={0.15}>
            <p className="mx-auto mt-6 max-w-sm text-xs italic opacity-40">
              A real toggle. No live forecast exists in this prototype — the
              data behind it is simulated, honestly.
            </p>
          </Reveal>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* COUNTDOWN */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-24 text-center md:py-32">
        <div className="mx-auto max-w-2xl">
          <Reveal>
            <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Countdown
            </p>
            <BigLine size="medium">A Passport signature.</BigLine>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="font-heading mt-6 text-7xl">
              {days === null ? "--" : days}
            </p>
            <p className="mt-1 text-sm opacity-60">
              days until Christmas — computed from today&apos;s real date.
            </p>
          </Reveal>
          <Reveal delay={0.2}>
            <div className="mt-10 flex flex-wrap justify-center gap-2">
              {COUNTDOWN_EXAMPLE_EVENTS.map((event) => (
                <span
                  key={event}
                  className="rounded-full border border-current/20 px-3 py-1.5 text-sm opacity-70"
                >
                  {event}
                </span>
              ))}
            </div>
          </Reveal>
          <Reveal delay={0.3}>
            <p className="mx-auto mt-6 max-w-md text-xs italic opacity-40">
              Days-until is real and computed live. The specific events above
              are illustrative examples, not real listings for any real date.
            </p>
          </Reveal>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* PHOTO MOMENTS */}
      {/* ============================================================ */}
      <ActShell tone="light" className="px-6 py-24 text-center">
        <div className="mx-auto max-w-2xl">
          <Reveal>
            <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Photo Moments
            </p>
            <p className="text-lg italic opacity-70">
              Passport quietly says:{" "}
              <em>&ldquo;You&apos;ll want to remember this.&rdquo;</em>
            </p>
          </Reveal>
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {PHOTO_MOMENT_CHIPS.map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-current/20 px-3 py-1.5 text-sm opacity-70"
              >
                {chip}
              </span>
            ))}
          </div>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* LITTLE MOMENTS */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-24 text-center">
        <div className="mx-auto max-w-2xl">
          <Reveal>
            <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Little Moments
            </p>
            <p className="text-lg italic opacity-70">
              Tiny joys. They&apos;re the ones that actually last.
            </p>
          </Reveal>
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {LITTLE_MOMENT_CHIPS.map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-current/20 px-3 py-1.5 text-sm opacity-70"
              >
                {chip}
              </span>
            ))}
          </div>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* CHRISTMAS CRAFTS */}
      {/* ============================================================ */}
      <ActShell tone="light" className="px-6 py-24 text-center">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Christmas Crafts
            </p>
            <BigLine size="medium">
              Passport should inspire making things together.
            </BigLine>
          </Reveal>
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {CRAFT_CHIPS.map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-current/20 px-3 py-1.5 text-sm opacity-70"
              >
                {chip}
              </span>
            ))}
          </div>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* GIVING */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-24 text-center">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Giving
            </p>
            <BigLine size="medium">
              Christmas isn&apos;t only receiving.
            </BigLine>
          </Reveal>
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {GIVING_CHIPS.map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-current/20 px-3 py-1.5 text-sm opacity-70"
              >
                {chip}
              </span>
            ))}
          </div>
          <Reveal delay={0.15}>
            <p className="mx-auto mt-8 max-w-xl text-base opacity-70">
              {GIVING_LINE}
            </p>
          </Reveal>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* SOUND DESIGN NOTE */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-24 text-center">
        <div className="mx-auto max-w-2xl">
          <Reveal>
            <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Sound Design
            </p>
            <p className="text-base opacity-70">{SOUND_DESIGN_NOTE}</p>
          </Reveal>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {SOUND_CHIPS.map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-current/20 px-3 py-1.5 text-sm opacity-70"
              >
                {chip}
              </span>
            ))}
          </div>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* PRODUCT PRINCIPLES */}
      {/* ============================================================ */}
      <ActShell tone="light" className="px-6 py-24 text-center">
        <div className="mx-auto max-w-lg">
          <Reveal>
            <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              What This Experiment Proves
            </p>
            <BigLine size="medium">
              The same Atlas. An entirely different emotional world.
            </BigLine>
          </Reveal>
          <Reveal delay={0.15}>
            <div className="mx-auto mt-8 flex flex-col gap-2 text-left">
              <p className="text-sm opacity-85">
                <strong>Atlas quietly provides:</strong> {ATLAS_PROVIDES}
              </p>
              <p className="text-sm opacity-85">
                <strong>Passport creates:</strong> {PASSPORT_CREATES}
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.25}>
            <p className="mt-8 text-base opacity-70">
              {PRINCIPLES_CLOSING_LINE}
            </p>
          </Reveal>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* ENDING */}
      {/* ============================================================ */}
      <ActShell
        tone="dark"
        className="flex min-h-[90svh] flex-col items-center justify-center bg-black px-6 text-center"
      >
        <style>{`
          @keyframes christmas-ornament-sway {
            0%, 100% { transform: rotate(-4deg); } 50% { transform: rotate(4deg); }
          }
        `}</style>
        <Reveal>
          <span
            className="inline-block text-2xl"
            style={{
              animation: "christmas-ornament-sway 2.6s ease-in-out infinite",
            }}
          >
            🔴
          </span>
        </Reveal>
        <Reveal delay={0.15}>
          <p className="font-heading mt-8 max-w-lg text-2xl italic opacity-85 md:text-3xl">
            {ENDING_LINE}
          </p>
        </Reveal>
        <div className="my-8 h-px w-14 bg-current/25" />
        <Reveal delay={0.3}>
          <BigLine size="large">{ENDING_FINAL_LINE}</BigLine>
        </Reveal>
        <Reveal delay={0.45}>
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="mt-12 rounded-full bg-[#c9a15a] px-6 py-3 text-sm font-bold text-[#0a1610]"
          >
            🎄 Plan Tomorrow
          </button>
        </Reveal>
        <Reveal delay={0.55}>
          <p className="mt-4 text-xs italic opacity-40">{ENDING_DISCLOSURE}</p>
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
              {LAB_NOTES_LINE}
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
