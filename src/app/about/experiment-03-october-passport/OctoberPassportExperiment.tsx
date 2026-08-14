"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, ExternalLink, Moon, Volume2, VolumeX } from "lucide-react";
import { ActShell, BigLine, Reveal } from "../components";
import { AmbientLayer } from "./AmbientLayer";
import { CinematicIntro } from "./CinematicIntro";
import { FearDial } from "./FearDial";
import { FindTheRaven } from "./FindTheRaven";
import { FlashlightMode } from "./FlashlightMode";
import { GhostButton } from "./GhostButton";
import { GhostPortrait } from "./GhostPortrait";
import { HistoryOrFolklore } from "./HistoryOrFolklore";
import { ScareCam } from "./ScareCam";
import { useSoundscape } from "./useSoundscape";
import {
  CITY_MODES,
  DISCOVERY_CARDS,
  ENDING_FINAL_LINE,
  ENDING_LAUGH_EMOJI,
  ENDING_LINES,
  GROUP_MODE_PROMPT,
  GROUP_SCARE_CAM_CONCEPT,
  INTENSITY_LEVELS,
  INTENSITY_ORDER,
  LOCAL_EVENTS_VANCOUVER,
  LOCAL_LEGENDS,
  LOCAL_TIP_EXAMPLE,
  LOST_BOYS_WORDS,
  MOVIE_PAIRINGS,
  PAGE_NOTICES_LINES,
  PERSONAS,
  SOUNDTRACK_DUCKS_LINE,
  THREE_VALLEY_GAP_SCENE,
  THREE_VALLEY_RESPONSES,
  VANCOUVER_CONCEPT,
  WEATHER_OPTIONS,
  groupCountedLine,
  intensityAtLeast,
  type Intensity,
  type Persona,
  type ThreeValleyAnswer,
  type Weather,
} from "./content";

const FEELING_WORDS = [
  "Fog",
  "Leaves",
  "Cold mornings",
  "Coffee",
  "Cabins",
  "Ghost stories",
  "History",
  "Old towns",
  "Campfires",
  "Golden forests",
  "Pumpkins",
  "Rain",
  "Mystery",
];

const LIVE_SEASONS_INPUTS = [
  "Season",
  "Weather",
  "Time of day",
  "Sunrise",
  "Sunset",
  "Local forecast",
  "Migration",
  "Wildflowers",
  "Snow",
  "Fall colours",
  "Meteor showers",
  "Rain",
  "Moon phase",
];

/** Fixed, deterministic — not random per render, so this stays SSR-safe. These three cards only reveal on a click, no matter what's selected above. */
const SECRET_CARD_IDS = ["attic-window", "ghost-post-office", "quiet-museum"];

const IDLE_THRESHOLD_MS = 26_000;
const HOVER_LINGER_MS = 2600;

/**
 * Experiment 03 — "October Passport," deepened for tension. The
 * structure from the first pass is untouched (persona × weather ×
 * intensity filtering, the ambient layer, two camera features, real
 * sourced local history); what's new is everything the brief asked for
 * to make it actually unsettling rather than cartoon-Halloween: a real
 * 3-tier intensity scale, a real idle/hover/behaviour-driven "the page
 * notices you" mechanic, a real synthesized soundscape, a Flashlight
 * Mode, and a substantially expanded, still-honestly-sourced Local
 * Legends section.
 *
 * Core tension principle, applied structurally: nothing here rewards
 * scrolling with a guaranteed scare. The ambient surprises stay rare and
 * unannounced (`AmbientLayer`); the "page notices you" lines are tied to
 * real signals and each only ever fires once per session, not on a
 * repeating timer — repetition is what turns tension into a joke.
 *
 * "Director's Cut" pass: pacing is now a deliberate arc, not a flat list
 * — curiosity (opening, feeling, Live Seasons, City Mode) → mystery
 * (Local Legends, moved here from the bottom of the page) → tension (the
 * Camera, two real mini-games, Group Mode) → release (the ending). A real
 * cinematic intro gates the whole experience behind an explicit "Enter"
 * click. Two real mini-games (`HistoryOrFolklore`, `FindTheRaven`) and
 * one playful button (`GhostButton`) add delight without ever blocking a
 * real interaction — the ghost button always stays catchable, the games
 * always have a real, checkable answer. `useSoundscape` gained `duck()`
 * (a real, brief audio dip tied to one specific rare surprise line) and
 * `fadeOut()` (a real wind-down called once, when the ending section
 * first scrolls into view) — sound now has a real arc too, not just an
 * on/off switch.
 *
 * "The Fear Dial" pass (Phase 7.16) — the signature interaction the brief
 * asked for. `FearDial` now gates entry right after the cinematic intro:
 * "How brave are you tonight?", four equally-weighted tiers (Cozy Autumn,
 * Spooky, Creepy, Nightmare), each a real ceremony, not a settings screen.
 * Intensity itself grew from 3 tiers to 4 — Nightmare is genuinely
 * opt-in, layering unsettling-but-tasteful effects (a crow crossing the
 * screen, a real full-screen heartbeat pulse, ambiguous whisper/static
 * lines) on top of, never replacing, the gentler tiers below it.
 * Flashlight Mode is a real 9-item find-game now (discovery first, story
 * second — no fragment text exists until its item is found).  Three
 * Valley Gap is a real layered scene (lightning, rain, a window light
 * that quietly turns off) before it asks anything, and the question now
 * branches three ways (YES / NO / ABSOLUTELY NOT), each with its own real
 * response. `useSoundscape` gained `setLayer()` — wind, rain, fire,
 * breathing, or silence, each a real distinct filter shape, not just a
 * volume nudge — and two sections now call it once, the moment they
 * scroll into view (Three Valley Gap → rain, Flashlight Mode →
 * breathing), so the soundtrack evolves with the page instead of playing
 * one tone all the way through. A new "Near You" section proves Atlas's
 * whole reason for existing — real event *categories* Vancouver actually
 * has, cross-referencing the two already-sourced Local Legends entries,
 * with the rest honestly labeled as example listings. Every button a
 * visitor is likely to actually hover picked up one small, real
 * micro-interaction (a persona emoji lifting and tilting, the moon icon
 * turning, the sound icon flexing, the back arrow nudging) — nothing
 * that competes with the ambient layer's own rare surprises for
 * attention. Movie-pacing rhythm (quiet, beautiful, interesting, funny,
 * one scare, quiet again) was reviewed rather than rebuilt: the ambient
 * surprise trigger chance was already a flat 12% per 20–45s interval
 * regardless of tier, so raising the tier only widens *which* lines can
 * appear, never how often anything fires — the rhythm the earlier pass
 * built already holds at Nightmare.
 */
export function OctoberPassportExperiment() {
  const [showIntro, setShowIntro] = useState(true);
  const [showFearDial, setShowFearDial] = useState(false);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [weather, setWeather] = useState<Weather>("clear");
  const [intensity, setIntensity] = useState<Intensity>("spooky");
  const [revealedSecrets, setRevealedSecrets] = useState<Set<string>>(
    new Set(),
  );
  const [idleNotice, setIdleNotice] = useState<string | null>(null);
  const [hoveredNotice, setHoveredNotice] = useState<string | null>(null);
  const [behaviourNotice, setBehaviourNotice] = useState<string | null>(null);
  const [city, setCity] = useState(CITY_MODES[0]!.id);
  const [groupInput, setGroupInput] = useState("");
  const [groupCount, setGroupCount] = useState<number | null>(null);
  const [endingReached, setEndingReached] = useState(false);
  const [threeValleyAnswer, setThreeValleyAnswer] =
    useState<ThreeValleyAnswer | null>(null);
  const threeValleyLayerSet = useRef(false);
  const flashlightLayerSet = useRef(false);

  const soundscape = useSoundscape(intensity);

  function onAmbientSurprise(line: string) {
    if (line === SOUNDTRACK_DUCKS_LINE) soundscape.duck();
  }

  const maxIntensityReached = useRef<Intensity>("cozy");
  const hasNoticedBrave = useRef(false);
  const hasNoticedBackingAway = useRef(false);
  // Seeded with 0, not Date.now() — reading the clock is a side effect and
  // isn't allowed during render; the real starting timestamp gets set the
  // moment the idle-tracking effect below actually runs.
  const lastActivity = useRef(0);
  const hoverTimer = useRef<number | null>(null);

  // Real behaviour signal #1: getting braver / backing away, tied to actual intensity changes, each noticed once.
  useEffect(() => {
    if (
      INTENSITY_ORDER.indexOf(intensity) >
      INTENSITY_ORDER.indexOf(maxIntensityReached.current)
    ) {
      maxIntensityReached.current = intensity;
      if (intensity === "nightmare" && !hasNoticedBrave.current) {
        hasNoticedBrave.current = true;
        setBehaviourNotice(PAGE_NOTICES_LINES.gettingBrave);
        window.setTimeout(() => setBehaviourNotice(null), 4000);
      }
    } else if (
      intensity === "cozy" &&
      maxIntensityReached.current !== "cozy" &&
      !hasNoticedBackingAway.current
    ) {
      hasNoticedBackingAway.current = true;
      setBehaviourNotice(PAGE_NOTICES_LINES.backingAway);
      window.setTimeout(() => setBehaviourNotice(null), 4000);
    }
  }, [intensity]);

  // Real behaviour signal #2: idle for a while, noticed once, quietly.
  useEffect(() => {
    lastActivity.current = Date.now();
    function markActive() {
      lastActivity.current = Date.now();
    }
    window.addEventListener("mousemove", markActive);
    window.addEventListener("keydown", markActive);
    window.addEventListener("scroll", markActive);
    window.addEventListener("touchstart", markActive);

    let noticed = false;
    const check = window.setInterval(() => {
      if (!noticed && Date.now() - lastActivity.current > IDLE_THRESHOLD_MS) {
        noticed = true;
        setIdleNotice(PAGE_NOTICES_LINES.idle);
        window.setTimeout(() => setIdleNotice(null), 5000);
      }
    }, 3000);

    return () => {
      window.removeEventListener("mousemove", markActive);
      window.removeEventListener("keydown", markActive);
      window.removeEventListener("scroll", markActive);
      window.removeEventListener("touchstart", markActive);
      window.clearInterval(check);
    };
  }, []);

  function onCardHoverStart() {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => {
      setHoveredNotice(PAGE_NOTICES_LINES.hoverLingered);
      window.setTimeout(() => setHoveredNotice(null), 3200);
    }, HOVER_LINGER_MS);
  }
  function onCardHoverEnd() {
    if (hoverTimer.current) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  }

  const visibleCards = useMemo(() => {
    return DISCOVERY_CARDS.filter((card) => {
      if (!intensityAtLeast(intensity, card.minIntensity)) return false;
      if (persona && !card.personas.includes(persona)) return false;
      if (!card.weather.includes(weather)) return false;
      return true;
    });
  }, [persona, weather, intensity]);

  function revealSecret(id: string) {
    setRevealedSecrets((prev) => new Set(prev).add(id));
  }

  return (
    <main className="relative bg-[#100c06] text-[#f3ead9]">
      {showIntro && (
        <CinematicIntro
          onEnter={() => {
            setShowIntro(false);
            setShowFearDial(true);
          }}
        />
      )}
      {!showIntro && showFearDial && (
        <FearDial
          onChoose={(chosen) => {
            setIntensity(chosen);
            setShowFearDial(false);
          }}
        />
      )}

      <AmbientLayer intensity={intensity} onSurprise={onAmbientSurprise} />

      <Link
        href="/about/ideas-to-make-pages"
        className="group fixed top-4 left-4 z-50 flex items-center gap-1.5 rounded-full border border-current/15 bg-[#100c06]/80 px-3 py-1.5 text-xs font-medium backdrop-blur-sm transition-opacity hover:opacity-70"
      >
        <ArrowLeft className="h-3 w-3 transition-transform duration-300 group-hover:-translate-x-1" />
        ELK Labs
      </Link>

      <button
        type="button"
        onClick={soundscape.toggle}
        className="group fixed top-4 right-4 z-50 flex items-center gap-1.5 rounded-full border border-current/15 bg-[#100c06]/80 px-3 py-1.5 text-xs font-medium backdrop-blur-sm transition-opacity hover:opacity-70"
      >
        {soundscape.on ? (
          <Volume2 className="h-3 w-3 transition-transform duration-300 group-hover:scale-110" />
        ) : (
          <VolumeX className="h-3 w-3 transition-transform duration-300 group-hover:rotate-6" />
        )}
        Sound {soundscape.on ? "On" : "Off"}
      </button>

      {/* Page Notices You — real, rare, quiet. Never more than one visible at once. */}
      {(idleNotice || hoveredNotice || behaviourNotice) && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.7 }}
          className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 text-sm text-[#f3ead9] italic"
        >
          {idleNotice ?? hoveredNotice ?? behaviourNotice}
        </motion.p>
      )}

      {/* ============================================================ */}
      {/* OPENING */}
      {/* ============================================================ */}
      <ActShell
        tone="dark"
        className="flex min-h-[100svh] flex-col items-center justify-center px-6 text-center"
      >
        <Reveal>
          <p className="mb-6 text-xs font-medium tracking-[0.35em] uppercase opacity-50">
            ELK Labs — Experiment 03
          </p>
          <BigLine size="massive">OCTOBER.</BigLine>
        </Reveal>
        <Reveal delay={0.35}>
          <p className="mt-6 max-w-lg text-lg opacity-70">
            Not Halloween. October.
          </p>
        </Reveal>
        <Reveal delay={0.55}>
          <p className="mt-8 max-w-md text-sm opacity-50">
            What if Passport transformed itself every October? Not with
            decorations. With atmosphere.
          </p>
        </Reveal>
      </ActShell>

      {/* ============================================================ */}
      {/* THE FEELING — word scatter */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-4xl">
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-3">
            {FEELING_WORDS.map((word, i) => (
              <Reveal key={word} delay={i * 0.05}>
                <span
                  className="font-heading opacity-90"
                  style={{
                    fontSize: `clamp(1.2rem, ${2.4 + (i % 4) * 0.7}vw, 3.2rem)`,
                  }}
                >
                  {word}
                </span>
              </Reveal>
            ))}
          </div>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* LIVE SEASONS — the standing philosophy */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Live Seasons
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <BigLine size="medium">
              The world changes. Passport changes with it.
            </BigLine>
          </Reveal>
          <Reveal delay={0.25}>
            <p className="mt-8 max-w-2xl text-lg leading-relaxed opacity-70">
              A permanent philosophy, not just an October costume — every
              Passport personality should be able to evolve with —
            </p>
          </Reveal>
          <Reveal delay={0.35}>
            <div className="mt-6 flex flex-wrap gap-2">
              {LIVE_SEASONS_INPUTS.map((input) => (
                <span
                  key={input}
                  className="rounded-full border border-current/20 px-3 py-1 text-sm opacity-70"
                >
                  {input}
                </span>
              ))}
            </div>
          </Reveal>
          <Reveal delay={0.5}>
            <p className="mt-8 max-w-xl text-sm italic opacity-40">
              Prototyped honestly below with one real dimension — weather —
              driving what actually surfaces. No live forecast API exists in
              this session; the toggle is real, the data behind it is simulated.
            </p>
          </Reveal>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* LOCAL CITY MODE */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-24 text-center">
        <div className="mx-auto max-w-xl">
          <Reveal>
            <p className="mb-6 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Passport Adapts To The City
            </p>
          </Reveal>
          <div className="flex flex-wrap justify-center gap-2">
            {CITY_MODES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCity(c.id)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-all hover:scale-105 ${
                  city === c.id
                    ? "bg-[#ff5a1f] text-[#171208]"
                    : "border border-current/20 opacity-70 hover:opacity-100"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <Reveal delay={0.15}>
            <p className="font-heading mt-8 text-2xl italic">
              {CITY_MODES.find((c) => c.id === city)?.line}
            </p>
          </Reveal>
          <p className="mt-4 text-xs italic opacity-30">
            Not your address, not your home — just the city, acknowledged.
          </p>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* WEATHER + PERSONA + INTENSITY — the real filters */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-4xl">
          <Reveal>
            <p className="text-center text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              What&apos;s the weather doing?
            </p>
          </Reveal>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {WEATHER_OPTIONS.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => setWeather(w.id)}
                className={`rounded-full px-5 py-2.5 text-sm font-medium transition-all hover:scale-105 ${
                  weather === w.id
                    ? "bg-[#ff5a1f] text-[#171208]"
                    : "border border-current/20 opacity-70 hover:opacity-100"
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>
          <Reveal delay={0.1}>
            <p className="mt-3 text-center text-sm italic opacity-50">
              {WEATHER_OPTIONS.find((w) => w.id === weather)?.atmosphere}
            </p>
            <p className="text-center text-xs opacity-40">
              {WEATHER_OPTIONS.find((w) => w.id === weather)?.note}
            </p>
          </Reveal>

          <Reveal delay={0.2}>
            <p className="mt-16 text-center text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Choose your October
            </p>
          </Reveal>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => setPersona(null)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-all hover:scale-105 ${
                persona === null
                  ? "bg-[#ff5a1f] text-[#171208]"
                  : "border border-current/20 opacity-70 hover:opacity-100"
              }`}
            >
              Everything
            </button>
            {PERSONAS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPersona(p.id)}
                className={`group flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all hover:scale-105 ${
                  persona === p.id
                    ? "bg-[#ff5a1f] text-[#171208]"
                    : "border border-current/20 opacity-70 hover:opacity-100"
                }`}
              >
                <span className="inline-block transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:rotate-6">
                  {p.emoji}
                </span>{" "}
                {p.label}
              </button>
            ))}
          </div>

          <Reveal delay={0.3}>
            <p className="mt-16 text-center text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Intensity
            </p>
            <p className="mx-auto mt-2 max-w-md text-center text-xs opacity-40">
              The same Passport personality, at a different volume — not a
              different product.
            </p>
          </Reveal>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {INTENSITY_LEVELS.map((level) => (
              <button
                key={level.id}
                type="button"
                onClick={() => setIntensity(level.id)}
                title={level.description}
                className={`group flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition-all hover:scale-105 ${
                  intensity === level.id
                    ? "border-[#ff5a1f] bg-[#ff5a1f]/15"
                    : "border-current/20 opacity-60 hover:opacity-100"
                }`}
              >
                {level.id === "nightmare" && (
                  <Moon className="h-3.5 w-3.5 transition-transform group-hover:rotate-12" />
                )}
                <span className="inline-block transition-transform duration-300 group-hover:-translate-y-0.5">
                  {level.emoji}
                </span>{" "}
                {level.label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-center text-xs opacity-40">
            {INTENSITY_LEVELS.find((l) => l.id === intensity)?.description}
          </p>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* LOCAL LEGENDS — real, sourced, cited. Moved here, into the story's */}
      {/* "mystery" middle, per the Director's Cut pacing arc: curiosity  */}
      {/* (opening) -> mystery (here) -> tension (camera, games, late) -> */}
      {/* release (ending). */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <p className="text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Local Legends
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <BigLine size="medium">
              Real stories. Real places. Let the visitor decide.
            </BigLine>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="mt-6 max-w-xl text-base leading-relaxed opacity-60">
              Passport doesn&apos;t say &ldquo;this is haunted.&rdquo; It says
              people have told stories about a place for generations, or that
              guests have reported strange experiences, or that nobody agrees on
              what happened. Every fact and legend below is real and sourced;
              every unsourced card says so plainly.
            </p>
          </Reveal>
          <div className="mt-12 flex flex-col gap-8">
            {LOCAL_LEGENDS.map((fact, i) => (
              <Reveal key={fact.title} delay={Math.min(i * 0.06, 0.3)}>
                <div
                  onMouseEnter={onCardHoverStart}
                  onMouseLeave={onCardHoverEnd}
                  className="border-l-2 border-[#ff5a1f]/40 pl-6"
                >
                  <div className="flex flex-wrap items-baseline gap-2">
                    <p className="font-heading text-2xl">{fact.title}</p>
                    <span className="rounded-full border border-current/20 px-2.5 py-0.5 text-xs tracking-wide uppercase opacity-60">
                      {fact.kind}
                    </span>
                  </div>
                  <p className="mt-3 text-base leading-relaxed opacity-75">
                    {fact.fact}
                  </p>
                  {fact.sourceUrl && (
                    <a
                      href={fact.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-sm opacity-50 hover:opacity-80"
                    >
                      Source: {fact.source} <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.4}>
            <p className="mt-10 max-w-xl text-sm italic opacity-40">
              A local tip transforms an experience: &ldquo;{LOCAL_TIP_EXAMPLE}
              &rdquo;
            </p>
          </Reveal>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* DISCOVERY — emergent, not dumped */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <p className="text-center text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              What&apos;s Emerging
            </p>
          </Reveal>
          {visibleCards.length === 0 ? (
            <Reveal delay={0.1}>
              <p className="mt-10 text-center text-sm opacity-50">
                Nothing matches that combination yet. Try a different weather,
                or a different intensity.
              </p>
            </Reveal>
          ) : (
            <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visibleCards.map((card, i) => {
                const isSecret = SECRET_CARD_IDS.includes(card.id);
                const revealed = !isSecret || revealedSecrets.has(card.id);
                return (
                  <Reveal key={card.id} delay={Math.min(i * 0.04, 0.3)}>
                    {revealed ? (
                      <div
                        onMouseEnter={onCardHoverStart}
                        onMouseLeave={onCardHoverEnd}
                        className="flex h-full flex-col gap-2 rounded-2xl border border-current/15 p-6"
                      >
                        <span className="text-3xl">{card.emoji}</span>
                        <p className="font-heading text-xl">{card.title}</p>
                        <p className="text-sm italic opacity-60">{card.line}</p>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => revealSecret(card.id)}
                        className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-current/25 p-6 text-center opacity-60 transition-opacity hover:opacity-100"
                      >
                        <span className="text-3xl">🕯️</span>
                        <p className="text-sm">
                          Something&apos;s here. Look closer.
                        </p>
                      </button>
                    )}
                  </Reveal>
                );
              })}
            </div>
          )}
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* FLASHLIGHT MODE */}
      {/* ============================================================ */}
      <motion.div
        onViewportEnter={() => {
          if (!flashlightLayerSet.current) {
            flashlightLayerSet.current = true;
            soundscape.setLayer("breathing");
          }
        }}
        viewport={{ once: true, amount: 0.5 }}
      >
        <ActShell tone="dark" className="px-6 py-24 md:py-32">
          <div className="mx-auto max-w-3xl">
            <Reveal>
              <p className="text-center text-xs font-medium tracking-[0.35em] uppercase opacity-40">
                Flashlight Mode
              </p>
            </Reveal>
            <Reveal delay={0.1}>
              <FlashlightMode />
            </Reveal>
          </div>
        </ActShell>
      </motion.div>

      {/* ============================================================ */}
      {/* THE CAMERA */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-4xl">
          <Reveal>
            <p className="text-center text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              The Camera
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mx-auto mt-4 max-w-xl text-center text-lg leading-relaxed opacity-70">
              Two real camera prototypes. Both entirely optional, both entirely
              local to your browser.
            </p>
          </Reveal>
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
            <Reveal delay={0.15}>
              <GhostPortrait />
            </Reveal>
            <Reveal delay={0.2}>
              <ScareCam />
            </Reveal>
          </div>
          <Reveal delay={0.3}>
            <div className="mx-auto mt-8 max-w-xl rounded-2xl border border-dashed border-current/20 p-6 text-center">
              <p className="text-xs font-semibold tracking-wide uppercase opacity-50">
                Group Scare Cam — Future Idea
              </p>
              <p className="mt-2 text-sm italic opacity-60">
                {GROUP_SCARE_CAM_CONCEPT}
              </p>
              <p className="mt-2 text-xs opacity-40">
                Not built here — no real networking exists in this prototype.
              </p>
            </div>
          </Reveal>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* THREE VALLEY GAP — a real layered scene, then a 3-way branch */}
      {/* ============================================================ */}
      <motion.div
        onViewportEnter={() => {
          if (!threeValleyLayerSet.current) {
            threeValleyLayerSet.current = true;
            soundscape.setLayer("rain");
          }
        }}
        viewport={{ once: true, amount: 0.5 }}
      >
        <ActShell
          tone="dark"
          className="relative flex min-h-[85svh] flex-col items-center justify-center overflow-hidden px-6 text-center"
        >
          <style>{`
          @keyframes tvg-lightning { 0%, 94%, 100% { opacity: 0; } 95% { opacity: 0.5; } 97% { opacity: 0.1; } 98% { opacity: 0.4; } }
          @keyframes tvg-rain { 0% { background-position: 0 0; } 100% { background-position: 0 200px; } }
          @keyframes tvg-window-off { 0%, 70% { opacity: 0.7; } 85%, 100% { opacity: 0.05; } }
        `}</style>
          <div
            className="pointer-events-none absolute inset-0"
            style={{ animation: "tvg-lightning 9s ease-in-out infinite" }}
          >
            <div className="absolute inset-0 bg-white" />
          </div>
          <div
            className="pointer-events-none absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "repeating-linear-gradient(100deg, transparent 0 2px, rgba(200,220,255,0.3) 2px 3px, transparent 3px 40px)",
              animation: "tvg-rain 0.4s linear infinite",
            }}
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black to-transparent" />
          <span
            className="pointer-events-none absolute right-[28%] bottom-[18%] h-2 w-2 rounded-full bg-[#e0bd7d]"
            style={{
              animation: "tvg-window-off 12s ease-in-out infinite",
              boxShadow: "0 0 8px 2px rgba(224,189,125,0.8)",
            }}
          />

          <Reveal>
            <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Three Valley Gap
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="max-w-lg text-lg leading-relaxed opacity-70">
              {THREE_VALLEY_GAP_SCENE.setup}
            </p>
          </Reveal>

          {threeValleyAnswer === null ? (
            <>
              <Reveal delay={0.3}>
                <div className="mt-10">
                  <BigLine size="large">
                    {THREE_VALLEY_GAP_SCENE.question}
                  </BigLine>
                </div>
              </Reveal>
              <Reveal delay={0.45}>
                <div className="mt-10 flex flex-wrap justify-center gap-3">
                  {(["yes", "no", "absolutelyNot"] as ThreeValleyAnswer[]).map(
                    (answer) => (
                      <button
                        key={answer}
                        type="button"
                        onClick={() => setThreeValleyAnswer(answer)}
                        className="rounded-full border border-current/25 px-6 py-2.5 text-sm font-semibold tracking-wide uppercase transition-transform hover:scale-105 hover:border-[#ff5a1f]"
                      >
                        {answer === "absolutelyNot"
                          ? "Absolutely not"
                          : answer.toUpperCase()}
                      </button>
                    ),
                  )}
                </div>
              </Reveal>
            </>
          ) : (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 0.85, y: 0 }}
              className="font-heading mt-10 max-w-md text-xl italic"
            >
              {THREE_VALLEY_RESPONSES[threeValleyAnswer]}
            </motion.p>
          )}
        </ActShell>
      </motion.div>

      {/* ============================================================ */}
      {/* LOCAL EVENTS — "Near You," proving Atlas exists. Real-shaped */}
      {/* event cards, prototyped with Vancouver; most are clearly labeled */}
      {/* example listings, two cross-reference the sourced Local Legends */}
      {/* entries above (Gastown Ghost Walks, the Sylvia Hotel). */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <p className="text-center text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Near You
            </p>
            <p className="mx-auto mt-4 max-w-xl text-center text-lg leading-relaxed opacity-70">
              This is what Atlas is for — not just atmosphere, real things
              happening nearby. Prototyped with Vancouver.
            </p>
          </Reveal>
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {LOCAL_EVENTS_VANCOUVER.map((event, i) => (
              <Reveal key={event.title} delay={Math.min(i * 0.04, 0.3)}>
                <div
                  onMouseEnter={onCardHoverStart}
                  onMouseLeave={onCardHoverEnd}
                  className="flex h-full flex-col gap-2 rounded-2xl border border-current/15 p-6 transition-transform hover:-translate-y-0.5"
                >
                  <span className="text-3xl">{event.emoji}</span>
                  <p className="font-heading text-lg">{event.title}</p>
                  <p className="text-sm italic opacity-60">{event.note}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.4}>
            <p className="mt-8 text-center text-xs italic opacity-30">
              Most of these are example listings, clearly labeled — a shape for
              what real, live Atlas event data would fill in. Gastown Ghost
              Walks and the Sylvia Hotel are real and already sourced above, in
              Local Legends.
            </p>
          </Reveal>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* VANCOUVER OCTOBER */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              A Glimpse — Vancouver
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="flex flex-wrap justify-center gap-2">
              {VANCOUVER_CONCEPT.words.map((w) => (
                <span
                  key={w}
                  className="rounded-full border border-current/20 px-3 py-1 text-sm opacity-70"
                >
                  {w}
                </span>
              ))}
            </div>
          </Reveal>
          <Reveal delay={0.25}>
            <div className="mt-10">
              <BigLine size="medium">{VANCOUVER_CONCEPT.line}</BigLine>
            </div>
          </Reveal>
          <Reveal delay={0.4}>
            <p className="mt-6 text-sm italic opacity-40">
              A hint of what a full Vancouver October Passport could become.
            </p>
          </Reveal>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* LOST BOYS ENERGY */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Not Always Victorian and Quiet
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="flex flex-wrap justify-center gap-x-5 gap-y-3">
              {LOST_BOYS_WORDS.map((w, i) => (
                <span
                  key={w}
                  className="font-heading opacity-90"
                  style={{
                    fontSize: `clamp(1.1rem, ${1.8 + (i % 3) * 0.6}vw, 2.6rem)`,
                  }}
                >
                  {w}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* THE MOVIES */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <p className="text-center text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              An October Evening
            </p>
            <p className="mx-auto mt-4 max-w-xl text-center text-lg leading-relaxed opacity-70">
              A movie is never the whole evening. Pair it with something real,
              right after.
            </p>
          </Reveal>
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MOVIE_PAIRINGS.map((movie, i) => (
              <Reveal key={movie.mood} delay={Math.min(i * 0.05, 0.3)}>
                <div className="flex h-full flex-col gap-2 rounded-2xl border border-current/15 p-6">
                  <span className="text-3xl">{movie.emoji}</span>
                  <p className="font-heading text-xl">{movie.mood}</p>
                  <p className="text-sm italic opacity-60">{movie.line}</p>
                  <p className="mt-2 text-sm font-medium text-[#ff5a1f]">
                    {movie.then}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* HALLOWEEN GAMES — tension, played out playfully, late in the arc */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-4xl">
          <Reveal>
            <p className="text-center text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              A Few Games, While You&apos;re Here
            </p>
            <p className="mx-auto mt-4 max-w-xl text-center text-lg leading-relaxed opacity-70">
              Fun first. Prototype only — a taste of a much longer list of ideas
              saved for later.
            </p>
          </Reveal>
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
            <Reveal delay={0.1}>
              <HistoryOrFolklore />
            </Reveal>
            <div className="flex flex-col gap-6">
              <Reveal delay={0.15}>
                <FindTheRaven />
              </Reveal>
              <Reveal delay={0.2}>
                <GhostButton />
              </Reveal>
            </div>
          </div>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* GROUP MODE — simulated, disclosed as such */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-24 text-center">
        <div className="mx-auto max-w-xl">
          <Reveal>
            <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Group Mode
            </p>
            <p className="mb-8 text-lg leading-relaxed opacity-70">
              Lights off. Headphones on. Everyone counted in.
            </p>
          </Reveal>
          {groupCount === null ? (
            <div className="flex flex-wrap items-center justify-center gap-3">
              <label htmlFor="group-count" className="sr-only">
                {GROUP_MODE_PROMPT}
              </label>
              <input
                id="group-count"
                type="number"
                min={1}
                max={12}
                value={groupInput}
                onChange={(e) => setGroupInput(e.target.value)}
                placeholder="How many of you?"
                className="w-40 rounded-full border border-current/20 bg-transparent px-4 py-2 text-center text-sm outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  const n = Math.max(
                    1,
                    Math.min(12, parseInt(groupInput, 10) || 1),
                  );
                  setGroupCount(n);
                }}
                className="rounded-full bg-[#ff5a1f] px-5 py-2 text-sm font-bold text-[#171208]"
              >
                Count us in
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <p className="font-heading text-2xl">
                {groupCountedLine(groupCount)}
              </p>
              <p className="max-w-sm text-sm italic opacity-50">
                Campfire Mode is on for the rest of your visit.
              </p>
              <button
                type="button"
                onClick={() => {
                  setGroupCount(null);
                  setGroupInput("");
                }}
                className="mt-2 text-xs opacity-40 hover:opacity-70"
              >
                Reset
              </button>
            </div>
          )}
          <p className="mt-8 max-w-md text-xs italic opacity-30">
            Simulated for this prototype — everyone here is really just you.
            Real multi-device sync, where friends on separate phones see the
            same countdown, is a future idea, not built here.
          </p>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* ENDING — the release. Fire dims, music fades, one lantern remains */}
      {/* ============================================================ */}
      <ActShell
        tone="dark"
        className="flex min-h-[95svh] flex-col items-center justify-center bg-black px-6 text-center"
      >
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          onViewportEnter={() => {
            if (!endingReached) {
              setEndingReached(true);
              if (soundscape.on) soundscape.fadeOut(4000);
            }
          }}
          transition={{ duration: 2.5 }}
          className="flex flex-col items-center gap-10"
        >
          <motion.span
            className="text-2xl"
            animate={endingReached ? { opacity: 0.35, scale: 0.8 } : {}}
            transition={{ duration: 4 }}
            style={
              !endingReached
                ? { animation: "candle-flicker 2.4s ease-in-out infinite" }
                : undefined
            }
          >
            🕯️
          </motion.span>
          <p className="font-heading max-w-md text-2xl italic opacity-80 md:text-3xl">
            {ENDING_LINES[0]}
          </p>
          <motion.div
            initial={{ opacity: 0 }}
            animate={endingReached ? { opacity: 1 } : {}}
            transition={{ delay: 3, duration: 1.5 }}
            className="flex flex-col items-center gap-3"
          >
            <span className="text-3xl">{ENDING_LAUGH_EMOJI}</span>
            <p className="text-lg italic opacity-60">{ENDING_FINAL_LINE}</p>
          </motion.div>
        </motion.div>
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
              experiment. This one tests whether Passport can become a living
              seasonal companion, not just a database with autumn colours
              applied.
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
