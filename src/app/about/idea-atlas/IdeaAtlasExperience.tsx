import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { ActShell, BigLine, Reveal } from "../components";
import { PersonalityCard } from "./PersonalityCard";
import {
  ADULTS_MODE_EXAMPLES,
  ADVENT_CALENDAR_EXAMPLES,
  ADVENT_CALENDAR_NOTE,
  ADVENT_DEC24_TEASE,
  ANALOG_PHILOSOPHY,
  ANALOG_PRINTABLES,
  ANTICIPATION_COUNTDOWN_STAGES,
  ANTICIPATION_ENGINE_TAGLINE,
  ANTICIPATION_ITEMS,
  ARGUMENT_ENGINE_EXAMPLE,
  ARGUMENT_ENGINE_NOTE,
  ARGUMENT_ENGINE_SURFACE,
  ATLAS_IS_RESEARCHER_LINE,
  ATLAS_OWNS,
  ATLAS_STRENGTHS,
  ATLAS_STRENGTHS_NOTE,
  AUDIENCE_MODE_NOTE,
  AUDIENCE_MODES,
  BOARD_GROWTH_STAGES,
  BOARD_NOT_SAVED_ITEMS,
  BORING_DISCOVERY_EXAMPLE,
  BORING_DISCOVERY_NOTE,
  BUSINESS_GOALS,
  BUSINESS_NOTE,
  CAMERA_IDEAS,
  CAMERA_MEMORY_MODE_NOTE,
  CARD_VOICES,
  CARDS_TALK_BACK_NOTE,
  CHRISTMAS_CHALLENGES,
  CHRISTMAS_NOT_SHOPPING,
  CHRISTMAS_WORLD,
  CLOSE_YOUR_EYES_EXAMPLES,
  CLOSE_YOUR_EYES_NOTE,
  CLOSE_YOUR_EYES_PROMPT,
  CLOSE_YOUR_EYES_REVEAL,
  CONFERENCE_COMPANION_HELPS,
  CORPORATE_RETREAT_INTENTS,
  CREATIVE_DIRECTION_TYPES,
  CRUSH_SYSTEM_LINES,
  CRUSH_SYSTEM_NOTE,
  DIRT_BIKER_EXAMPLE,
  DISCOVERY_INSIGHT_LINE,
  DISCOVERY_INSIGHT_QUOTE,
  DISCOVERY_MAP_LAYERS,
  DISCOVERY_MAP_NOTE,
  DISCOVERY_MAP_QUESTION,
  DISCOVERY_METHODS,
  DONT_LOSE_IDEAS_NOTE,
  DREAMS,
  ELK_LABS_AMBITION,
  ELK_LABS_PHILOSOPHY,
  ELK_LABS_QUOTES,
  ELK_LABS_TAGLINE,
  EVENT_TYPES,
  EVENTS_NOTE,
  EVERYDAY_UTILITY_NOTE,
  EVERYDAY_UTILITY_QUERIES,
  EXPERIMENT_MAP,
  FEAR_DIAL_AFFECTS,
  FEAR_DIAL_LEVELS,
  FEAR_DIAL_PRINCIPLE,
  FEAR_DIAL_QUESTION,
  FINAL_TEST_FAILURE_LINE,
  FINAL_TEST_QUESTION,
  FUTURE_TECHNOLOGY,
  GROUP_GAMES,
  GROUP_GAMES_NOTE,
  HELL_YEAH_METER_REACTIONS,
  HELL_YEAH_ONE_PERSONALITY_NOTE,
  HELL_YEAH_ROOM_NOTE,
  HELL_YEAH_SHOUTS,
  HESITATION_INTERPRETATIONS,
  HESITATION_PROTOTYPE_NOTE,
  HESITATION_SIGNAL_LINE,
  HYPE_MAN_LINES,
  HYPE_MAN_NOTE,
  INTERACTION_LIBRARY,
  KNOWLEDGE_ACQUISITION_PRINCIPLES,
  KNOWLEDGE_ACQUISITION_STEPS,
  KNOWLEDGE_COVERAGE_CATEGORIES,
  KNOWLEDGE_COVERAGE_NOTE,
  KNOWLEDGE_COVERAGE_VIEWS,
  LESS_TECHNOLOGY_LINE,
  LIFE_MOMENTS,
  LOCAL_KNOWLEDGE_EXAMPLES,
  LOCAL_KNOWLEDGE_LINE,
  MANIFESTO_CLOSE,
  MANIFESTO_LINES,
  MANIFESTO_PRINCIPLES,
  MEMORY_BOX_LINE,
  MEMORY_OUTPUTS,
  METEOR_SHOWER_BRING,
  METEOR_SHOWER_CONDITIONS,
  METEOR_SHOWER_CTA,
  METEOR_SHOWER_INPUTS,
  MINI_MISSIONS,
  MINI_MISSIONS_NOTE,
  MOOD_BOARD_INTENT,
  MOOD_BOARD_NOTE,
  MOVIE_DAY_QUESTION,
  MOVIE_TO_EXPERIENCE,
  MOVIE_WALL,
  OCTOBER_ATMOSPHERE_PRINCIPLE,
  OCTOBER_ELEMENTS,
  OCTOBER_INTERACTIONS,
  OCTOBER_MODES,
  OCTOBER_NOT_JUST_HALLOWEEN,
  PAGE_USE_NOTE,
  PASSPORT_OWNS,
  PASSPORT_SOUL_LABEL,
  PASSPORT_SOUL_SEQUENCE,
  PEOPLE_KNOW_HOW_THEY_WANT_TO_FEEL,
  PERFECT_CONDITIONS,
  PERSONALITIES,
  POSSIBILITY_ATOMS,
  PRODUCT_PRINCIPLES,
  PROFESSIONAL_PASSPORTS,
  PUPPY_DOG_BOARD_LINE,
  PUPPY_DOG_BOARD_PAGES,
  PURPOSE_QUOTE,
  PURPOSE_STATEMENTS,
  QUICK_PEEK_MINIMAL_FIELDS,
  QUICK_PEEK_MODES,
  QUICK_PEEK_PRINCIPLE,
  QUOTE_WALL,
  RANDOM_IDEAS,
  RESEARCH_TOPICS,
  RETURN_LOOPS,
  RETURN_LOOPS_NOTE,
  RIDICULOUS_TITLES,
  RHYTHM_BEATS,
  RHYTHM_INSTRUMENTS,
  RHYTHM_QUOTE,
  SEASONS,
  SHAREABILITY_IDEAS,
  SHAREABILITY_NOTE,
  SOUND_DESIGN_BY_PERSONALITY,
  SOUND_INGREDIENTS,
  SOUND_PERSONALITIES,
  SPLIT_QUOTES,
  STUDY_EXAMPLES,
  SUPER_LIKE_NOTE,
  SWIPE_FORMAT_NOTE,
  SWIPE_GESTURES,
  TODAY_WE_TEMPLATE,
  TRADITIONS_EXAMPLES,
  TRADITIONS_NOTE,
  TRADITIONS_YEARLY_ADDITIONS,
  TRAILER_DISCLAIMER,
  TRAILER_IDEA_OPTIONS,
  TRAILER_PRINCIPLE,
  TRIVIA_EXAMPLES,
  TRIVIA_HUNT_MECHANIC,
  TRIVIA_HUNT_USE_CASES,
  TRIVIA_PRINCIPLE,
  VIDEO_EXAMPLES,
  VIDEO_PRINCIPLE,
  VIDEO_TYPES,
  WEATHER_DUALITY_NOTE,
  WEATHER_PASSPORTS,
  WHO_ARE_YOU_TODAY_NOT,
  WHO_ARE_YOU_TODAY_PRINCIPLE,
  WHO_ARE_YOU_TODAY_QUESTIONS,
  WHY_SILENCE,
  WONDER_IDEAS,
  WONDER_NOT_KIDS_APP_NOTE,
  WONDER_WHO_FOR,
  WORD_OF_DAY_EXAMPLES,
  WORD_OF_DAY_NOTE,
  type ExperimentStatus,
} from "./content";

/** A plain wrapper for the many chip-cloud sections — same visual language, no repeated markup per section. */
function ChipCloud({ items }: { items: readonly string[] }) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-full border border-current/20 px-3 py-1.5 text-sm opacity-70"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

const STATUS_COLOR: Record<ExperimentStatus, string> = {
  Idea: "opacity-50",
  Prototype: "text-[#ff5a1f]",
  Paused: "opacity-50",
  Merged: "opacity-50",
  Killed: "opacity-30 line-through",
  Shipped: "text-[#ff5a1f]",
};

/**
 * /about/idea-atlas — the master creative wall. Not documentation, not a
 * roadmap. The one page in ELK Labs meant to be revisited for years,
 * indexing everything else this family of experiments has produced —
 * forty-two Passport personalities, life moments, seasons, anticipation,
 * weather, the interaction library, camera ideas, sound design, a movie
 * wall, product principles, a quote wall, local knowledge, future tech,
 * an unorganized random-ideas pile, research topics, the experiment map,
 * and closing dreams.
 *
 * Deliberately visual over textual per its own brief: chip clouds and
 * expandable cards, almost no prose paragraph runs longer than two
 * sentences. Server component — nothing here needs client state except
 * `PersonalityCard`'s own expand/collapse, which is its own small client
 * island, the same pattern `ExperimentCard.tsx` established.
 */
export function IdeaAtlasExperience() {
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
      {/* MANIFESTO */}
      {/* ============================================================ */}
      <ActShell
        tone="dark"
        className="flex min-h-[100svh] flex-col items-center justify-center px-6 text-center"
      >
        <Reveal>
          <p className="mb-6 text-xs font-medium tracking-[0.35em] uppercase opacity-50">
            ELK Labs — Idea Atlas
          </p>
          <BigLine size="massive">DREAM.</BigLine>
        </Reveal>
        <div className="mt-10 flex max-w-2xl flex-col gap-3">
          {MANIFESTO_LINES.map((line, i) => (
            <Reveal key={line} delay={0.3 + i * 0.15}>
              <p className="text-lg leading-relaxed opacity-80 md:text-xl">
                {line}
              </p>
            </Reveal>
          ))}
        </div>
        <div className="mt-10 flex max-w-lg flex-wrap justify-center gap-3">
          {MANIFESTO_PRINCIPLES.map((p, i) => (
            <Reveal key={p} delay={0.8 + i * 0.1}>
              <span className="rounded-full border border-current/20 px-3 py-1.5 text-sm opacity-70">
                {p}
              </span>
            </Reveal>
          ))}
        </div>
        <div className="mt-12 flex flex-col gap-1">
          {MANIFESTO_CLOSE.map((line, i) => (
            <Reveal key={line} delay={1.5 + i * 0.15}>
              <p className="text-xs italic opacity-40">{line}</p>
            </Reveal>
          ))}
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* ELK LABS — the studio philosophy */}
      {/* ============================================================ */}
      <ActShell tone="light" className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              ELK Labs
            </p>
            <BigLine size="medium">{ELK_LABS_TAGLINE}</BigLine>
          </Reveal>
          <div className="mx-auto mt-8 flex max-w-xl flex-col gap-2">
            {ELK_LABS_PHILOSOPHY.map((line, i) => (
              <Reveal key={line} delay={0.15 + i * 0.08}>
                <p className="text-base leading-relaxed opacity-70">{line}</p>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.4}>
            <div className="mt-10 flex flex-col gap-2">
              {ELK_LABS_QUOTES.map((q) => (
                <p key={q} className="font-heading text-lg italic opacity-80">
                  &ldquo;{q}&rdquo;
                </p>
              ))}
            </div>
          </Reveal>
          <Reveal delay={0.5}>
            <p className="mt-10 mb-3 text-xs font-medium tracking-[0.2em] uppercase opacity-40">
              Examples worth studying
            </p>
          </Reveal>
          <ChipCloud items={STUDY_EXAMPLES} />
          <Reveal delay={0.6}>
            <p className="mx-auto mt-8 max-w-md text-sm italic opacity-50">
              {ELK_LABS_AMBITION}
            </p>
          </Reveal>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* THE FUNDAMENTAL PASSPORT / ATLAS SPLIT */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-4xl">
          <Reveal>
            <BigLine size="medium" className="text-center">
              Atlas understands. Passport inspires.
            </BigLine>
            <p className="mx-auto mt-6 max-w-xl text-center text-lg leading-relaxed opacity-70">
              {ATLAS_IS_RESEARCHER_LINE}
            </p>
          </Reveal>
          <div className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-2">
            <Reveal delay={0.15}>
              <p className="mb-3 text-xs font-medium tracking-[0.2em] uppercase opacity-40">
                Atlas owns
              </p>
              <ChipCloud items={ATLAS_OWNS} />
            </Reveal>
            <Reveal delay={0.25}>
              <p className="mb-3 text-xs font-medium tracking-[0.2em] uppercase opacity-40">
                Passport owns
              </p>
              <ChipCloud items={PASSPORT_OWNS} />
            </Reveal>
          </div>
          <div className="mt-14 flex flex-col gap-3">
            {SPLIT_QUOTES.map((q, i) => (
              <Reveal key={q} delay={0.1 + i * 0.06}>
                <p className="text-center text-base leading-relaxed italic opacity-70">
                  {q}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* PASSPORT'S REAL PURPOSE */}
      {/* ============================================================ */}
      <ActShell tone="light" className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <p className="text-center text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Passport&apos;s Real Purpose
            </p>
            <p className="mx-auto mt-4 max-w-xl text-center text-sm italic opacity-50">
              Capture all of these, even where they overlap.
            </p>
          </Reveal>
          <div className="mt-10 flex flex-col divide-y divide-current/10">
            {PURPOSE_STATEMENTS.map((p, i) => (
              <Reveal key={p} delay={Math.min(i * 0.04, 0.3)}>
                <p className="py-3 text-base leading-relaxed opacity-80">{p}</p>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.3}>
            <p className="mx-auto mt-10 max-w-xl text-center text-base leading-relaxed italic opacity-60">
              {LESS_TECHNOLOGY_LINE}
            </p>
          </Reveal>
          <Reveal delay={0.4}>
            <p className="font-heading mt-8 text-center text-2xl">
              &ldquo;{PURPOSE_QUOTE}&rdquo;
            </p>
          </Reveal>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* THE BIG DISCOVERY INSIGHT */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              The Big Discovery Insight
            </p>
            <BigLine size="medium">
              People collect possibilities, not places.
            </BigLine>
          </Reveal>
          <Reveal delay={0.15}>
            <div className="mt-8">
              <ChipCloud items={POSSIBILITY_ATOMS} />
            </div>
          </Reveal>
          <Reveal delay={0.25}>
            <p className="mx-auto mt-8 max-w-xl text-base leading-relaxed italic opacity-60">
              {DISCOVERY_INSIGHT_LINE}
            </p>
          </Reveal>
          <Reveal delay={0.35}>
            <p className="mt-10 mb-3 text-xs font-medium tracking-[0.2em] uppercase opacity-40">
              People often know
            </p>
            <ChipCloud items={PEOPLE_KNOW_HOW_THEY_WANT_TO_FEEL} />
          </Reveal>
          <Reveal delay={0.45}>
            <p className="font-heading mx-auto mt-10 max-w-xl text-xl italic opacity-80">
              {DISCOVERY_INSIGHT_QUOTE}
            </p>
          </Reveal>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* WHO ARE YOU TODAY? */}
      {/* ============================================================ */}
      <ActShell tone="light" className="px-6 py-24 text-center">
        <div className="mx-auto max-w-2xl">
          <Reveal>
            <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Who Are You Today?
            </p>
            <p className="mx-auto mb-8 max-w-lg text-base leading-relaxed opacity-70">
              {WHO_ARE_YOU_TODAY_PRINCIPLE}
            </p>
          </Reveal>
          <Reveal delay={0.15}>
            <ChipCloud items={DIRT_BIKER_EXAMPLE} />
          </Reveal>
          <Reveal delay={0.3}>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              {WHO_ARE_YOU_TODAY_QUESTIONS.map((q) => (
                <span key={q} className="font-heading text-2xl">
                  &ldquo;{q}&rdquo;
                </span>
              ))}
            </div>
            <p className="mt-4 text-sm italic opacity-40">
              Not: &ldquo;{WHO_ARE_YOU_TODAY_NOT}&rdquo;
            </p>
          </Reveal>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* PASSPORT PERSONALITIES */}
      {/* ============================================================ */}
      <ActShell tone="light" className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <p className="text-center text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Passport Personalities
            </p>
            <p className="mx-auto mt-4 max-w-xl text-center text-lg leading-relaxed opacity-70">
              The same Atlas. Infinite personalities.{" "}
              {PERSONALITIES.filter((p) => p.status === "Prototype").length}{" "}
              real prototypes so far,{" "}
              {PERSONALITIES.filter((p) => p.status === "Idea").length} more
              waiting.
            </p>
          </Reveal>
          <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2">
            {PERSONALITIES.map((personality) => (
              <PersonalityCard key={personality.id} personality={personality} />
            ))}
          </div>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* DISCOVERY METHODS — Passport should not force one style */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-4xl text-center">
          <Reveal>
            <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Discovery Methods
            </p>
            <p className="mx-auto mb-10 max-w-xl text-lg leading-relaxed opacity-70">
              Different people discover differently. Capture all the discovery
              languages as separate ideas.
            </p>
          </Reveal>
          <div className="grid grid-cols-1 gap-2 text-left sm:grid-cols-2 lg:grid-cols-4">
            {DISCOVERY_METHODS.map((method, i) => (
              <Reveal key={method} delay={Math.min(i * 0.02, 0.3)}>
                <p className="flex items-baseline gap-2 text-sm opacity-70">
                  <span className="font-heading text-xs opacity-40">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {method}
                </p>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.4}>
            <div className="mx-auto mt-12 max-w-md rounded-2xl border border-dashed border-current/20 p-6">
              <p className="font-heading text-lg">{BORING_DISCOVERY_EXAMPLE}</p>
              <p className="mt-2 text-sm italic opacity-60">
                {BORING_DISCOVERY_NOTE}
              </p>
            </div>
          </Reveal>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* THE ORIGINAL MOOD BOARD + THE PUPPY-DOG BOARD */}
      {/* ============================================================ */}
      <ActShell tone="light" className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              The Mood Board
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <ChipCloud items={MOOD_BOARD_INTENT} />
          </Reveal>
          <Reveal delay={0.2}>
            <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed italic opacity-60">
              {MOOD_BOARD_NOTE}
            </p>
          </Reveal>

          <Reveal delay={0.3}>
            <p className="mt-16 mb-3 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              The Puppy-Dog Board
            </p>
            <p className="font-heading mx-auto max-w-md text-xl italic opacity-80">
              {PUPPY_DOG_BOARD_LINE}
            </p>
          </Reveal>
          <Reveal delay={0.4}>
            <div className="mt-6">
              <ChipCloud items={PUPPY_DOG_BOARD_PAGES} />
            </div>
          </Reveal>
          <div className="mx-auto mt-10 flex max-w-xl flex-col gap-2">
            {BOARD_GROWTH_STAGES.map((stage, i) => (
              <Reveal key={stage.count} delay={0.1 + i * 0.08}>
                <p className="flex items-baseline justify-center gap-3 text-sm">
                  <span className="font-heading text-base opacity-80">
                    {stage.count}
                  </span>
                  <span className="opacity-50">—</span>
                  <span className="italic opacity-60">{stage.label}</span>
                </p>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.6}>
            <p className="mx-auto mt-8 max-w-xl text-sm italic opacity-50">
              {BOARD_NOT_SAVED_ITEMS}
            </p>
          </Reveal>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* DETAILS / QUICK PEEK */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-24">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Details / Quick Peek
            </p>
            <p className="mx-auto mb-8 max-w-xl text-base leading-relaxed opacity-70">
              {QUICK_PEEK_PRINCIPLE}
            </p>
          </Reveal>
          <ChipCloud items={QUICK_PEEK_MODES} />
          <Reveal delay={0.15}>
            <p className="mt-10 mb-3 text-xs font-medium tracking-[0.2em] uppercase opacity-40">
              Sometimes, only this much is needed
            </p>
          </Reveal>
          <ChipCloud items={QUICK_PEEK_MINIMAL_FIELDS} />
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* DISCOVERY MAP */}
      {/* ============================================================ */}
      <ActShell tone="light" className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-4xl text-center">
          <Reveal>
            <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Discovery Map
            </p>
            <BigLine size="medium">
              &ldquo;{DISCOVERY_MAP_QUESTION}&rdquo;
            </BigLine>
          </Reveal>
          <Reveal delay={0.15}>
            <div className="mt-10">
              <ChipCloud items={DISCOVERY_MAP_LAYERS} />
            </div>
          </Reveal>
          <Reveal delay={0.3}>
            <p className="mx-auto mt-8 max-w-xl text-base leading-relaxed italic opacity-60">
              {DISCOVERY_MAP_NOTE}
            </p>
          </Reveal>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* CLOSE YOUR EYES / VOICE DISCOVERY */}
      {/* ============================================================ */}
      <ActShell
        tone="dark"
        className="flex min-h-[70svh] flex-col items-center justify-center px-6 text-center"
      >
        <Reveal>
          <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
            Close Your Eyes / Voice Discovery
          </p>
          <BigLine size="large">&ldquo;{CLOSE_YOUR_EYES_PROMPT}&rdquo;</BigLine>
        </Reveal>
        <div className="mt-10 flex flex-col gap-2">
          {CLOSE_YOUR_EYES_EXAMPLES.map((line, i) => (
            <Reveal key={line} delay={0.15 + i * 0.1}>
              <p className="italic opacity-60">&ldquo;{line}&rdquo;</p>
            </Reveal>
          ))}
        </div>
        <Reveal delay={0.7}>
          <p className="font-heading mt-10 text-xl opacity-80">
            {CLOSE_YOUR_EYES_REVEAL}
          </p>
        </Reveal>
        <Reveal delay={0.85}>
          <p className="mx-auto mt-6 max-w-md text-sm italic opacity-40">
            {CLOSE_YOUR_EYES_NOTE}
          </p>
        </Reveal>
      </ActShell>

      {/* ============================================================ */}
      {/* LIFE MOMENTS */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-24">
        <div className="mx-auto max-w-4xl text-center">
          <Reveal>
            <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Life Moments
            </p>
            <p className="mx-auto mb-8 max-w-lg text-lg leading-relaxed opacity-70">
              Not activities. Life. This is the reason people are planning at
              all.
            </p>
          </Reveal>
          <ChipCloud items={LIFE_MOMENTS} />
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* SEASONS */}
      {/* ============================================================ */}
      <ActShell tone="light" className="px-6 py-24">
        <div className="mx-auto max-w-4xl text-center">
          <Reveal>
            <p className="mb-8 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Seasons
            </p>
          </Reveal>
          <ChipCloud items={SEASONS} />
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* ANTICIPATION */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <p className="mb-4 text-center text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Anticipation
            </p>
            <BigLine size="medium" className="text-center">
              &ldquo;What should I be excited about?&rdquo;
            </BigLine>
            <p className="mx-auto mt-6 max-w-xl text-center text-lg leading-relaxed opacity-70">
              Not only &ldquo;what can I do?&rdquo; Passport becomes a calendar
              of excitement. Not reminders. Excitement.
            </p>
          </Reveal>
          <div className="mt-14 flex flex-col gap-6">
            {ANTICIPATION_ITEMS.map((item, i) => (
              <Reveal key={item.line} delay={Math.min(i * 0.05, 0.3)}>
                <div className="flex items-start gap-4 border-l-2 border-[#ff5a1f]/40 pl-5">
                  <span className="text-2xl">{item.emoji}</span>
                  <div>
                    <p className="font-heading text-lg">{item.line}</p>
                    <p className="mt-1 text-sm italic opacity-60">{item.why}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.2}>
            <p className="mt-14 mb-3 text-center text-xs font-medium tracking-[0.2em] uppercase opacity-40">
              The countdown scale
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm opacity-60">
              {ANTICIPATION_COUNTDOWN_STAGES.map((stage, i) => (
                <span key={stage} className="flex items-center gap-3">
                  {stage}
                  {i < ANTICIPATION_COUNTDOWN_STAGES.length - 1 && (
                    <span className="opacity-30">→</span>
                  )}
                </span>
              ))}
            </div>
            <p className="mt-4 text-center text-sm italic opacity-50">
              {ANTICIPATION_ENGINE_TAGLINE}
            </p>
          </Reveal>

          <Reveal delay={0.3}>
            <p className="mt-16 mb-3 text-center text-xs font-medium tracking-[0.2em] uppercase opacity-40">
              The Meteor Shower Experience
            </p>
          </Reveal>
          <div className="mx-auto mt-4 max-w-md rounded-2xl border border-current/15 p-6 text-center">
            {METEOR_SHOWER_CONDITIONS.map((c) => (
              <p key={c} className="text-base opacity-70">
                {c}
              </p>
            ))}
            <p className="mt-4 text-xs font-medium tracking-[0.2em] uppercase opacity-40">
              Bring
            </p>
            <p className="mt-1 text-sm italic opacity-60">
              {METEOR_SHOWER_BRING.join(" · ")}
            </p>
            <p className="font-heading mt-5 text-lg">{METEOR_SHOWER_CTA}</p>
          </div>
          <Reveal delay={0.4}>
            <div className="mx-auto mt-6 max-w-lg">
              <ChipCloud items={METEOR_SHOWER_INPUTS} />
            </div>
          </Reveal>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* WEATHER */}
      {/* ============================================================ */}
      <ActShell tone="light" className="px-6 py-24">
        <div className="mx-auto max-w-4xl text-center">
          <Reveal>
            <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Weather
            </p>
            <p className="mx-auto mb-8 max-w-lg text-lg leading-relaxed opacity-70">
              Weather is not data. Weather changes Discovery, mood,
              recommendations, and personality.
            </p>
          </Reveal>
          <ChipCloud items={WEATHER_PASSPORTS} />
          <div className="mt-6">
            <ChipCloud items={PERFECT_CONDITIONS} />
          </div>
          <p className="mx-auto mt-8 max-w-lg text-sm italic opacity-50">
            {WEATHER_DUALITY_NOTE}
          </p>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* INTERACTION LIBRARY */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <p className="text-center text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Interaction Library
            </p>
            <p className="mx-auto mt-4 max-w-xl text-center text-lg leading-relaxed opacity-70">
              Every interaction, and why it exists. Not decoration — each one is
              doing a real job.
            </p>
          </Reveal>
          <div className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {INTERACTION_LIBRARY.map((entry, i) => (
              <Reveal key={entry.name} delay={Math.min(i * 0.02, 0.3)}>
                <div className="flex h-full flex-col gap-1.5 rounded-xl border border-current/15 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-heading text-base">{entry.name}</p>
                    {entry.builtIn && (
                      <span className="shrink-0 rounded-full bg-[#ff5a1f]/20 px-2 py-0.5 text-[10px] font-semibold text-[#ff5a1f] uppercase">
                        Built
                      </span>
                    )}
                  </div>
                  <p className="text-xs italic opacity-60">{entry.why}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* DISCOVERY SWIPE — gestures, hesitation, cards talk back, crush */}
      {/* ============================================================ */}
      <ActShell tone="light" className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-4xl">
          <Reveal>
            <p className="text-center text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Discovery Swipe
            </p>
            <p className="mx-auto mt-4 max-w-xl text-center text-lg leading-relaxed opacity-70">
              {SWIPE_FORMAT_NOTE}
            </p>
          </Reveal>
          <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {SWIPE_GESTURES.map((g, i) => (
              <Reveal key={g.gesture} delay={0.1 + i * 0.06}>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-current/15 px-4 py-3">
                  <span className="font-heading text-sm">{g.gesture}</span>
                  <span className="text-sm italic opacity-60">{g.meaning}</span>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.3}>
            <p className="mx-auto mt-6 max-w-xl text-center text-sm italic opacity-50">
              {SUPER_LIKE_NOTE}
            </p>
          </Reveal>

          <Reveal delay={0.35}>
            <p className="mt-16 mb-3 text-center text-xs font-medium tracking-[0.2em] uppercase opacity-40">
              Hesitation As Signal
            </p>
            <p className="mx-auto max-w-xl text-center text-base leading-relaxed opacity-70">
              {HESITATION_SIGNAL_LINE}
            </p>
          </Reveal>
          <Reveal delay={0.45}>
            <div className="mt-6">
              <ChipCloud items={HESITATION_INTERPRETATIONS} />
            </div>
            <p className="mx-auto mt-4 max-w-md text-center text-sm italic opacity-50">
              tick. tick. tick. — {HESITATION_PROTOTYPE_NOTE}
            </p>
          </Reveal>

          <Reveal delay={0.5}>
            <p className="mt-16 mb-3 text-center text-xs font-medium tracking-[0.2em] uppercase opacity-40">
              Cards Talk Back
            </p>
          </Reveal>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CARD_VOICES.map((card, i) => (
              <Reveal key={card.experience} delay={Math.min(i * 0.04, 0.3)}>
                <div className="flex h-full flex-col gap-1.5 rounded-xl border border-current/15 p-4">
                  <p className="font-heading text-sm">{card.experience}</p>
                  {card.lines.map((line) => (
                    <p key={line} className="text-sm italic opacity-60">
                      &ldquo;{line}&rdquo;
                    </p>
                  ))}
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.55}>
            <p className="mx-auto mt-6 max-w-xl text-center text-sm italic opacity-50">
              {CARDS_TALK_BACK_NOTE}
            </p>
          </Reveal>

          <Reveal delay={0.6}>
            <p className="mt-16 mb-3 text-center text-xs font-medium tracking-[0.2em] uppercase opacity-40">
              The Crush System
            </p>
          </Reveal>
          <div className="mx-auto mt-4 flex max-w-xl flex-col gap-2">
            {CRUSH_SYSTEM_LINES.map((line, i) => (
              <Reveal key={line} delay={0.1 + i * 0.05}>
                <p className="text-center text-base italic opacity-70">
                  &ldquo;{line}&rdquo;
                </p>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.7}>
            <p className="mx-auto mt-6 max-w-md text-center text-sm italic opacity-50">
              {CRUSH_SYSTEM_NOTE}
            </p>
          </Reveal>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* HELL YEAH / GROUP DISCOVERY */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-4xl text-center">
          <Reveal>
            <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              HELL YEAH / Group Discovery
            </p>
            <p className="mx-auto mb-2 max-w-xl text-lg leading-relaxed opacity-70">
              {HELL_YEAH_ROOM_NOTE}
            </p>
            <p className="mx-auto max-w-xl text-sm italic opacity-40">
              {HELL_YEAH_ONE_PERSONALITY_NOTE}
            </p>
          </Reveal>
          <Reveal delay={0.15}>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              {HELL_YEAH_SHOUTS.map((shout, i) => (
                <span
                  key={shout}
                  className="font-heading text-lg opacity-90"
                  style={{
                    fontSize: `clamp(1rem, ${1.4 + (i % 4) * 0.4}vw, 2rem)`,
                  }}
                >
                  {shout}
                </span>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.25}>
            <p className="mt-16 mb-3 text-xs font-medium tracking-[0.2em] uppercase opacity-40">
              The HELL YEAH Meter — room energy, not a rating control
            </p>
            <div className="mt-4">
              <ChipCloud items={HELL_YEAH_METER_REACTIONS} />
            </div>
          </Reveal>

          <Reveal delay={0.35}>
            <p className="mt-16 mb-3 text-xs font-medium tracking-[0.2em] uppercase opacity-40">
              Group Games / Gamification
            </p>
            <p className="mx-auto max-w-xl text-sm italic opacity-50">
              {GROUP_GAMES_NOTE}
            </p>
          </Reveal>
          <div className="mx-auto mt-6 flex max-w-2xl flex-col gap-1.5 text-left">
            {GROUP_GAMES.map((g) => (
              <p key={g} className="text-sm opacity-70">
                {g}
              </p>
            ))}
          </div>
          <div className="mt-6">
            <ChipCloud items={RIDICULOUS_TITLES} />
          </div>

          <Reveal delay={0.45}>
            <p className="mt-16 mb-2 text-xs font-medium tracking-[0.2em] uppercase opacity-40">
              Argument Engine
            </p>
            <p className="mx-auto max-w-lg text-sm italic opacity-50">
              {ARGUMENT_ENGINE_NOTE}
            </p>
          </Reveal>
          <div className="mx-auto mt-6 max-w-md rounded-2xl border border-current/15 p-6 text-left">
            <p className="font-heading text-lg">
              {ARGUMENT_ENGINE_EXAMPLE.activity}
            </p>
            <p className="mt-1 text-sm opacity-60">
              {ARGUMENT_ENGINE_EXAMPLE.votes}
            </p>
            <p className="font-heading mt-3 italic opacity-80">
              &ldquo;{ARGUMENT_ENGINE_EXAMPLE.response}&rdquo;
            </p>
            <div className="mt-4">
              <ChipCloud items={ARGUMENT_ENGINE_SURFACE} />
            </div>
          </div>

          <Reveal delay={0.55}>
            <p className="mt-16 mb-2 text-xs font-medium tracking-[0.2em] uppercase opacity-40">
              The Hype Man
            </p>
            <p className="mx-auto max-w-lg text-sm italic opacity-50">
              {HYPE_MAN_NOTE}
            </p>
          </Reveal>
          <div className="mx-auto mt-6 flex max-w-xl flex-col gap-2">
            {HYPE_MAN_LINES.map((line, i) => (
              <Reveal key={line} delay={0.1 + i * 0.06}>
                <p className="text-base italic opacity-70">
                  &ldquo;{line}&rdquo;
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* VIDEOS AS FIRST-CLASS CONTENT */}
      {/* ============================================================ */}
      <ActShell tone="light" className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-4xl text-center">
          <Reveal>
            <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Videos As First-Class Content
            </p>
            <p className="mx-auto mb-10 max-w-xl text-lg leading-relaxed opacity-70">
              {VIDEO_PRINCIPLE}
            </p>
          </Reveal>
          <ChipCloud items={VIDEO_TYPES} />
          <Reveal delay={0.15}>
            <p className="mt-10 mb-3 text-xs font-medium tracking-[0.2em] uppercase opacity-40">
              Examples
            </p>
          </Reveal>
          <ChipCloud items={VIDEO_EXAMPLES} />
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* CAMERA IDEAS */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-24">
        <div className="mx-auto max-w-4xl text-center">
          <Reveal>
            <p className="mb-8 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Camera Ideas
            </p>
          </Reveal>
          <ChipCloud items={CAMERA_IDEAS} />
          <Reveal delay={0.15}>
            <p className="mx-auto mt-8 max-w-xl text-sm italic opacity-50">
              {CAMERA_MEMORY_MODE_NOTE}
            </p>
          </Reveal>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* SOUND DESIGN */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Sound Design
            </p>
            <p className="mx-auto mb-8 max-w-lg text-lg leading-relaxed opacity-70">
              Every personality deserves a soundtrack. Not licensed music. Sound
              design.
            </p>
          </Reveal>
          <ChipCloud items={SOUND_PERSONALITIES} />
          <Reveal delay={0.15}>
            <p className="mt-10 mb-3 text-xs font-medium tracking-[0.2em] uppercase opacity-40">
              The Ingredients
            </p>
          </Reveal>
          <ChipCloud items={SOUND_INGREDIENTS} />
          <Reveal delay={0.25}>
            <p className="mx-auto mt-10 max-w-xl text-sm leading-relaxed italic opacity-60">
              {WHY_SILENCE}
            </p>
          </Reveal>
          <Reveal delay={0.35}>
            <p className="mt-16 mb-3 text-xs font-medium tracking-[0.2em] uppercase opacity-40">
              Sound, By Personality
            </p>
          </Reveal>
          <div className="mt-6 grid grid-cols-1 gap-3 text-left sm:grid-cols-2">
            {SOUND_DESIGN_BY_PERSONALITY.map((s, i) => (
              <Reveal key={s.personality} delay={Math.min(i * 0.05, 0.3)}>
                <div className="rounded-xl border border-current/15 p-4">
                  <p className="font-heading text-sm">{s.personality}</p>
                  <p className="mt-1 text-sm italic opacity-60">
                    {s.ingredients.join(" · ")}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* MOVIE WALL */}
      {/* ============================================================ */}
      <ActShell tone="light" className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <p className="text-center text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Movie Wall
            </p>
            <p className="mx-auto mt-4 max-w-xl text-center text-lg leading-relaxed opacity-70">
              Movies that inspire Passport. Not because we copy them. Because
              they create emotion.
            </p>
          </Reveal>
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MOVIE_WALL.map((movie, i) => (
              <Reveal key={movie.title} delay={Math.min(i * 0.03, 0.3)}>
                <div className="flex h-full flex-col gap-2 rounded-xl border border-current/15 p-5">
                  <p className="font-heading text-lg">{movie.title}</p>
                  <p className="text-sm italic opacity-60">{movie.feeling}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.3}>
            <p className="font-heading mx-auto mt-16 max-w-xl text-center text-2xl italic opacity-80">
              &ldquo;{MOVIE_DAY_QUESTION}&rdquo;
            </p>
            <p className="mx-auto mt-3 max-w-xl text-center text-sm italic opacity-50">
              Movies are not recommendations merely to watch. Passport can
              translate the feeling into a real experience.
            </p>
          </Reveal>
          <div className="mx-auto mt-10 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
            {MOVIE_TO_EXPERIENCE.map((m, i) => (
              <Reveal key={m.title} delay={0.1 + i * 0.08}>
                <div className="rounded-xl border border-current/15 p-4 text-center">
                  <p className="font-heading text-sm">{m.title}</p>
                  <p className="mt-1 text-xs italic opacity-60">
                    {m.elements.join(" · ")}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.4}>
            <p className="mt-16 mb-3 text-center text-xs font-medium tracking-[0.2em] uppercase opacity-40">
              Trailers / Best Moments / Clips
            </p>
          </Reveal>
          <div className="mx-auto max-w-2xl">
            <ChipCloud items={TRAILER_IDEA_OPTIONS} />
          </div>
          <Reveal delay={0.5}>
            <p className="mx-auto mt-6 max-w-xl text-center text-sm leading-relaxed italic opacity-60">
              {TRAILER_PRINCIPLE}
            </p>
            <p className="mx-auto mt-2 max-w-xl text-center text-xs italic opacity-40">
              {TRAILER_DISCLAIMER}
            </p>
          </Reveal>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* OCTOBER PASSPORT — deep dive + Fear Dial */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-4xl text-center">
          <Reveal>
            <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              October Passport
            </p>
            <p className="mx-auto mb-8 max-w-xl text-lg leading-relaxed opacity-70">
              {OCTOBER_NOT_JUST_HALLOWEEN}
            </p>
          </Reveal>
          <ChipCloud items={OCTOBER_ELEMENTS} />
          <Reveal delay={0.15}>
            <p className="mt-10 mb-3 text-xs font-medium tracking-[0.2em] uppercase opacity-40">
              Key modes
            </p>
          </Reveal>
          <ChipCloud items={OCTOBER_MODES} />

          <Reveal delay={0.25}>
            <p className="mt-16 mb-3 text-xs font-medium tracking-[0.2em] uppercase opacity-40">
              Fear Dial / Consent To Scare
            </p>
            <BigLine size="medium">&ldquo;{FEAR_DIAL_QUESTION}&rdquo;</BigLine>
          </Reveal>
          <Reveal delay={0.35}>
            <div className="mt-8">
              <ChipCloud items={FEAR_DIAL_LEVELS} />
            </div>
          </Reveal>
          <Reveal delay={0.4}>
            <p className="mt-8 mb-3 text-xs font-medium tracking-[0.2em] uppercase opacity-40">
              The choice changes
            </p>
            <ChipCloud items={FEAR_DIAL_AFFECTS} />
          </Reveal>
          <Reveal delay={0.5}>
            <p className="mx-auto mt-8 max-w-xl text-base leading-relaxed italic opacity-60">
              {FEAR_DIAL_PRINCIPLE}
            </p>
          </Reveal>

          <Reveal delay={0.55}>
            <p className="mt-16 mb-4 text-xs font-medium tracking-[0.2em] uppercase opacity-40">
              October Interactions
            </p>
          </Reveal>
          <div className="mx-auto grid max-w-4xl grid-cols-2 gap-x-4 gap-y-1.5 text-left sm:grid-cols-3">
            {OCTOBER_INTERACTIONS.map((interaction) => (
              <p key={interaction} className="text-sm opacity-60">
                {interaction}
              </p>
            ))}
          </div>
          <Reveal delay={0.65}>
            <p className="mx-auto mt-8 max-w-xl text-sm italic opacity-50">
              {OCTOBER_ATMOSPHERE_PRINCIPLE}
            </p>
          </Reveal>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* CHRISTMAS PASSPORT — deep dive, Challenges, Advent Calendar */}
      {/* ============================================================ */}
      <ActShell tone="light" className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-4xl text-center">
          <Reveal>
            <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Christmas Passport
            </p>
            <p className="mx-auto mb-8 max-w-xl text-lg leading-relaxed opacity-70">
              {CHRISTMAS_NOT_SHOPPING}
            </p>
          </Reveal>
          <ChipCloud items={CHRISTMAS_WORLD} />

          <Reveal delay={0.15}>
            <p className="mt-16 mb-4 text-xs font-medium tracking-[0.2em] uppercase opacity-40">
              Christmas Challenges
            </p>
          </Reveal>
          <div className="mx-auto grid max-w-3xl grid-cols-1 gap-x-6 gap-y-1.5 text-left sm:grid-cols-2">
            {CHRISTMAS_CHALLENGES.map((c) => (
              <p key={c} className="text-sm opacity-60">
                {c}
              </p>
            ))}
          </div>

          <Reveal delay={0.25}>
            <p className="mt-16 mb-2 text-xs font-medium tracking-[0.2em] uppercase opacity-40">
              Christmas Advent Calendar
            </p>
            <p className="mx-auto max-w-xl text-base leading-relaxed opacity-70">
              {ADVENT_CALENDAR_NOTE}
            </p>
          </Reveal>
          <Reveal delay={0.35}>
            <div className="mt-6">
              <ChipCloud items={ADVENT_CALENDAR_EXAMPLES} />
            </div>
          </Reveal>
          <Reveal delay={0.45}>
            <p className="mx-auto mt-6 max-w-md text-sm italic opacity-50">
              December 24: {ADVENT_DEC24_TEASE}
            </p>
          </Reveal>

          <Reveal delay={0.5}>
            <p className="mt-16 mb-2 text-xs font-medium tracking-[0.2em] uppercase opacity-40">
              Return Loops By Personality
            </p>
            <p className="mx-auto max-w-lg text-sm italic opacity-50">
              {RETURN_LOOPS_NOTE}
            </p>
          </Reveal>
          <div className="mx-auto mt-6 flex max-w-2xl flex-wrap justify-center gap-3">
            {RETURN_LOOPS.map((r) => (
              <span
                key={r.personality}
                className="rounded-full border border-current/20 px-3 py-1.5 text-sm opacity-70"
              >
                <span className="opacity-50">{r.personality}:</span>{" "}
                {r.loopName}
              </span>
            ))}
          </div>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* TRIVIA + TRIVIA ADVENTURE / TRIVIA HUNT */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-24">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Trivia
            </p>
            <p className="mx-auto mb-8 max-w-xl text-base leading-relaxed opacity-70">
              {TRIVIA_PRINCIPLE}
            </p>
          </Reveal>
          <div className="mx-auto flex max-w-xl flex-col gap-2">
            {TRIVIA_EXAMPLES.map((t) => (
              <p key={t} className="text-sm italic opacity-60">
                {t}
              </p>
            ))}
          </div>

          <Reveal delay={0.15}>
            <p className="mt-14 mb-2 text-xs font-medium tracking-[0.2em] uppercase opacity-40">
              Trivia Adventure / Trivia Hunt
            </p>
            <p className="mx-auto max-w-lg text-base leading-relaxed opacity-70">
              {TRIVIA_HUNT_MECHANIC}
            </p>
          </Reveal>
          <Reveal delay={0.25}>
            <div className="mt-6">
              <ChipCloud items={TRIVIA_HUNT_USE_CASES} />
            </div>
          </Reveal>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* WONDER — deep dive, Word of the Day, Mini Missions */}
      {/* ============================================================ */}
      <ActShell tone="light" className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Wonder
            </p>
            <p className="mx-auto mb-8 max-w-xl text-lg leading-relaxed opacity-70">
              {WONDER_NOT_KIDS_APP_NOTE}
            </p>
          </Reveal>
          <p className="mb-3 text-xs font-medium tracking-[0.2em] uppercase opacity-40">
            Who
          </p>
          <ChipCloud items={WONDER_WHO_FOR} />
          <Reveal delay={0.15}>
            <p className="mt-10 mb-3 text-xs font-medium tracking-[0.2em] uppercase opacity-40">
              Ideas
            </p>
          </Reveal>
          <ChipCloud items={WONDER_IDEAS} />

          <Reveal delay={0.25}>
            <p className="mt-16 mb-2 text-xs font-medium tracking-[0.2em] uppercase opacity-40">
              Word Of The Day
            </p>
          </Reveal>
          <ChipCloud items={WORD_OF_DAY_EXAMPLES} />
          <p className="mx-auto mt-3 max-w-sm text-sm italic opacity-50">
            {WORD_OF_DAY_NOTE}
          </p>

          <Reveal delay={0.35}>
            <p className="mt-16 mb-2 text-xs font-medium tracking-[0.2em] uppercase opacity-40">
              Mini Missions
            </p>
          </Reveal>
          <div className="mx-auto flex max-w-xl flex-col gap-1.5">
            {MINI_MISSIONS.map((m) => (
              <p key={m} className="text-sm opacity-60">
                {m}
              </p>
            ))}
          </div>
          <p className="mt-3 text-sm italic opacity-50">{MINI_MISSIONS_NOTE}</p>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* ANALOG PASSPORT + ADVENTURE TOGETHER / MEMORY */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Analog Passport
            </p>
            <p className="mx-auto mb-8 max-w-xl text-lg leading-relaxed opacity-70">
              Use technology to enable less technology.
            </p>
          </Reveal>
          <ChipCloud items={ANALOG_PRINTABLES} />
          <div className="mx-auto mt-8 flex max-w-xl flex-col gap-1.5">
            {ANALOG_PHILOSOPHY.map((line) => (
              <p key={line} className="text-sm italic opacity-60">
                {line}
              </p>
            ))}
          </div>

          <Reveal delay={0.25}>
            <p className="mt-16 mb-3 text-xs font-medium tracking-[0.2em] uppercase opacity-40">
              Adventure Together / Memory
            </p>
            <p className="font-heading text-2xl italic opacity-80">
              Today We...
            </p>
          </Reveal>
          <Reveal delay={0.35}>
            <div className="mt-6">
              <ChipCloud items={TODAY_WE_TEMPLATE} />
            </div>
          </Reveal>
          <Reveal delay={0.45}>
            <p className="mt-10 mb-3 text-xs font-medium tracking-[0.2em] uppercase opacity-40">
              Generate
            </p>
            <ChipCloud items={MEMORY_OUTPUTS} />
          </Reveal>
          <Reveal delay={0.55}>
            <p className="mx-auto mt-8 max-w-md text-sm italic opacity-50">
              {MEMORY_BOX_LINE}
            </p>
          </Reveal>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* PRODUCT PRINCIPLES */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <p className="mb-8 text-center text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Product Principles
            </p>
          </Reveal>
          <div className="flex flex-col divide-y divide-current/10">
            {PRODUCT_PRINCIPLES.map((p, i) => (
              <Reveal key={p} delay={Math.min(i * 0.03, 0.3)}>
                <p className="py-3 text-base leading-relaxed opacity-80">{p}</p>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.3}>
            <p className="mt-6 text-xs italic opacity-40">
              Full reasoning behind each of these lives in{" "}
              <code>project-management/brand-principles.md</code>.
            </p>
          </Reveal>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* QUOTE WALL */}
      {/* ============================================================ */}
      <ActShell tone="light" className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-4xl">
          <Reveal>
            <p className="mb-12 text-center text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Quote Wall
            </p>
          </Reveal>
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-6">
            {QUOTE_WALL.map((quote, i) => (
              <Reveal key={quote} delay={Math.min(i * 0.04, 0.4)}>
                <span
                  className="font-heading opacity-85"
                  style={{
                    fontSize: `clamp(1.1rem, ${1.8 + (i % 5) * 0.5}vw, 2.8rem)`,
                  }}
                >
                  {quote}
                </span>
              </Reveal>
            ))}
          </div>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* LOCAL KNOWLEDGE */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-24">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <p className="mb-8 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Local Knowledge
            </p>
          </Reveal>
          <ChipCloud items={LOCAL_KNOWLEDGE_EXAMPLES} />
          <Reveal delay={0.15}>
            <p className="mx-auto mt-8 max-w-xl text-sm leading-relaxed italic opacity-60">
              {LOCAL_KNOWLEDGE_LINE}
            </p>
          </Reveal>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* PROFESSIONAL / PRACTICAL PASSPORTS + EVERYDAY UTILITY */}
      {/* ============================================================ */}
      <ActShell tone="light" className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Professional / Practical Passports
            </p>
            <p className="mx-auto mb-8 max-w-xl text-base leading-relaxed opacity-70">
              Not every Passport personality is magical or silly.
            </p>
          </Reveal>
          <ChipCloud items={PROFESSIONAL_PASSPORTS} />
          <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2">
            <Reveal delay={0.15}>
              <p className="mb-3 text-xs font-medium tracking-[0.2em] uppercase opacity-40">
                Conference Companion helps with
              </p>
              <ChipCloud items={CONFERENCE_COMPANION_HELPS} />
            </Reveal>
            <Reveal delay={0.25}>
              <p className="mb-3 text-xs font-medium tracking-[0.2em] uppercase opacity-40">
                Corporate Retreat can begin with intent
              </p>
              <ChipCloud items={CORPORATE_RETREAT_INTENTS} />
            </Reveal>
          </div>

          <Reveal delay={0.35}>
            <p className="mt-16 mb-2 text-xs font-medium tracking-[0.2em] uppercase opacity-40">
              Everyday Utility
            </p>
            <p className="mx-auto max-w-lg text-sm italic opacity-50">
              {EVERYDAY_UTILITY_NOTE}
            </p>
          </Reveal>
          <div className="mx-auto mt-6 flex max-w-xl flex-col gap-1.5">
            {EVERYDAY_UTILITY_QUERIES.map((q) => (
              <p key={q} className="text-sm opacity-60">
                {q}
              </p>
            ))}
          </div>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* PERSONALITY INTENSITY / AUDIENCE MODE */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-24 text-center">
        <div className="mx-auto max-w-2xl">
          <Reveal>
            <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Personality Intensity / Audience Mode
            </p>
          </Reveal>
          <ChipCloud items={AUDIENCE_MODES} />
          <Reveal delay={0.15}>
            <p className="mt-8 mb-3 text-xs font-medium tracking-[0.2em] uppercase opacity-40">
              Adults can be
            </p>
          </Reveal>
          <ChipCloud items={ADULTS_MODE_EXAMPLES} />
          <Reveal delay={0.25}>
            <p className="mx-auto mt-6 max-w-md text-sm italic opacity-50">
              {AUDIENCE_MODE_NOTE}
            </p>
          </Reveal>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* EVENTS */}
      {/* ============================================================ */}
      <ActShell tone="light" className="px-6 py-24">
        <div className="mx-auto max-w-4xl text-center">
          <Reveal>
            <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Events
            </p>
            <p className="mx-auto mb-8 max-w-lg text-base leading-relaxed opacity-70">
              {EVENTS_NOTE}
            </p>
          </Reveal>
          <ChipCloud items={EVENT_TYPES} />
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* FUTURE TECHNOLOGY */}
      {/* ============================================================ */}
      <ActShell tone="light" className="px-6 py-24">
        <div className="mx-auto max-w-4xl text-center">
          <Reveal>
            <p className="mb-8 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Future Technology
            </p>
          </Reveal>
          <ChipCloud items={FUTURE_TECHNOLOGY} />
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* "WHAT ATLAS ALREADY DOES BETTER" + KNOWLEDGE COVERAGE + LOOP */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              What Atlas Already Does Better
            </p>
          </Reveal>
          <ChipCloud items={ATLAS_STRENGTHS} />
          <Reveal delay={0.15}>
            <p className="mx-auto mt-6 max-w-lg text-sm italic opacity-50">
              {ATLAS_STRENGTHS_NOTE}
            </p>
          </Reveal>

          <Reveal delay={0.25}>
            <p className="mt-16 mb-2 text-xs font-medium tracking-[0.2em] uppercase opacity-40">
              Knowledge Coverage — internal / admin concept
            </p>
          </Reveal>
          <ChipCloud items={KNOWLEDGE_COVERAGE_CATEGORIES} />
          <Reveal delay={0.35}>
            <p className="mt-8 mb-3 text-xs font-medium tracking-[0.2em] uppercase opacity-40">
              Potential views
            </p>
          </Reveal>
          <ChipCloud items={KNOWLEDGE_COVERAGE_VIEWS} />
          <Reveal delay={0.45}>
            <p className="mx-auto mt-6 max-w-lg text-sm italic opacity-50">
              {KNOWLEDGE_COVERAGE_NOTE}
            </p>
          </Reveal>

          <Reveal delay={0.55}>
            <p className="mt-16 mb-3 text-xs font-medium tracking-[0.2em] uppercase opacity-40">
              Knowledge Acquisition Loop
            </p>
          </Reveal>
          <div className="mx-auto flex max-w-md flex-col gap-1 text-left">
            {KNOWLEDGE_ACQUISITION_STEPS.map((step, i) => (
              <p key={step} className="text-sm opacity-60">
                <span className="opacity-40">{i + 1}.</span> {step}
              </p>
            ))}
          </div>
          <div className="mx-auto mt-6 flex max-w-lg flex-col gap-1.5">
            {KNOWLEDGE_ACQUISITION_PRINCIPLES.map((p) => (
              <p key={p} className="font-heading text-base italic opacity-80">
                &ldquo;{p}&rdquo;
              </p>
            ))}
          </div>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* PASSPORT EXPERIENCE RHYTHM */}
      {/* ============================================================ */}
      <ActShell tone="light" className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Passport Experience Rhythm
            </p>
            <p className="mx-auto mb-8 max-w-lg text-base leading-relaxed opacity-70">
              Pages should have rhythm like movies and music.
            </p>
          </Reveal>
          <div className="flex flex-wrap justify-center gap-x-2 gap-y-2 text-sm opacity-70">
            {RHYTHM_BEATS.map((beat, i) => (
              <span key={beat} className="flex items-center gap-2">
                <span className="font-heading">{beat}</span>
                {i < RHYTHM_BEATS.length - 1 && (
                  <span className="opacity-30">→</span>
                )}
              </span>
            ))}
          </div>
          <Reveal delay={0.15}>
            <p className="mt-10 mb-3 text-xs font-medium tracking-[0.2em] uppercase opacity-40">
              A page can alternate
            </p>
          </Reveal>
          <ChipCloud items={RHYTHM_INSTRUMENTS} />
          <Reveal delay={0.25}>
            <p className="font-heading mx-auto mt-8 max-w-md text-xl italic opacity-80">
              &ldquo;{RHYTHM_QUOTE}&rdquo;
            </p>
          </Reveal>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* MEDIA / CREATIVE DIRECTION — Passport Soul */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Media / Creative Direction
            </p>
          </Reveal>
          <ChipCloud items={CREATIVE_DIRECTION_TYPES} />
          <Reveal delay={0.15}>
            <p className="mt-10 mb-3 text-xs font-medium tracking-[0.2em] uppercase opacity-40">
              Reference emotional sequence
            </p>
          </Reveal>
          <p className="mx-auto max-w-xl text-base leading-relaxed italic opacity-70">
            {PASSPORT_SOUL_SEQUENCE.join(" → ")}
          </p>
          <Reveal delay={0.3}>
            <p className="font-heading mt-8 text-2xl">{PASSPORT_SOUL_LABEL}</p>
          </Reveal>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* BUSINESS / SUCCESS + SHAREABILITY */}
      {/* ============================================================ */}
      <ActShell tone="light" className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Business / Success
            </p>
          </Reveal>
          <ChipCloud items={BUSINESS_GOALS} />
          <Reveal delay={0.15}>
            <p className="mx-auto mt-6 max-w-xl text-sm leading-relaxed italic opacity-50">
              {BUSINESS_NOTE}
            </p>
          </Reveal>

          <Reveal delay={0.25}>
            <p className="mt-16 mb-2 text-xs font-medium tracking-[0.2em] uppercase opacity-40">
              Shareability
            </p>
          </Reveal>
          <ChipCloud items={SHAREABILITY_IDEAS} />
          <Reveal delay={0.35}>
            <p className="mx-auto mt-6 max-w-xl text-sm leading-relaxed italic opacity-50">
              {SHAREABILITY_NOTE}
            </p>
          </Reveal>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* TRADITIONS */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Traditions
            </p>
          </Reveal>
          <ChipCloud items={TRADITIONS_EXAMPLES} />
          <Reveal delay={0.15}>
            <p className="mt-10 mb-3 text-xs font-medium tracking-[0.2em] uppercase opacity-40">
              Each year: the familiar world, plus
            </p>
          </Reveal>
          <ChipCloud items={TRADITIONS_YEARLY_ADDITIONS} />
          <Reveal delay={0.25}>
            <p className="mx-auto mt-8 max-w-xl text-base leading-relaxed italic opacity-60">
              {TRADITIONS_NOTE}
            </p>
          </Reveal>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* RANDOM IDEAS — the playground, deliberately unorganized */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <p className="mb-3 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Random Ideas
            </p>
            <p className="mx-auto mb-10 max-w-md text-sm italic opacity-50">
              Never organized. This is the playground. Nothing is too crazy to
              capture.
            </p>
          </Reveal>
          <div className="flex flex-wrap justify-center gap-3">
            {RANDOM_IDEAS.map((idea, i) => (
              <Reveal key={idea} delay={Math.min(i * 0.02, 0.3)}>
                <span
                  className="inline-block rounded border border-current/15 px-3 py-2 text-sm opacity-70"
                  style={{ transform: `rotate(${((i * 37) % 7) - 3}deg)` }}
                >
                  {idea}
                </span>
              </Reveal>
            ))}
          </div>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* THINGS TO RESEARCH */}
      {/* ============================================================ */}
      <ActShell tone="light" className="px-6 py-24">
        <div className="mx-auto max-w-4xl text-center">
          <Reveal>
            <p className="mb-8 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Things To Research
            </p>
          </Reveal>
          <ChipCloud items={RESEARCH_TOPICS} />
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* EXPERIMENT MAP */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <p className="mb-4 text-center text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Experiment Map
            </p>
            <p className="mx-auto mb-12 max-w-lg text-center text-sm italic opacity-50">
              Never delete old experiments. Ideas evolve.
            </p>
          </Reveal>
          <div className="flex flex-col gap-3">
            {EXPERIMENT_MAP.map((exp, i) => (
              <Reveal key={exp.number} delay={Math.min(i * 0.05, 0.3)}>
                <div className="flex items-center justify-between gap-4 border-b border-current/10 pb-3">
                  <div className="flex items-baseline gap-3">
                    <span className="font-heading text-sm opacity-40">
                      {exp.number}
                    </span>
                    <span className="text-base">{exp.title}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs font-semibold tracking-wide uppercase ${STATUS_COLOR[exp.status]}`}
                    >
                      {exp.status}
                    </span>
                    {exp.href && (
                      <Link
                        href={exp.href}
                        className="opacity-50 hover:opacity-100"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* DREAMS */}
      {/* ============================================================ */}
      <ActShell tone="dark" className="px-6 py-32 md:py-48">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <p className="mb-12 text-center text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              Dreams
            </p>
          </Reveal>
          <div className="flex flex-col gap-6">
            {DREAMS.map((dream, i) => (
              <Reveal key={dream} delay={Math.min(i * 0.06, 0.4)}>
                <p className="font-heading text-center text-xl leading-snug opacity-85 md:text-2xl">
                  {dream}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* HOW TO USE THIS PAGE + DO NOT LOSE IDEAS + FINAL TEST */}
      {/* ============================================================ */}
      <ActShell tone="light" className="px-6 py-24 md:py-32">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <p className="mb-4 text-xs font-medium tracking-[0.35em] uppercase opacity-40">
              How To Use This Page
            </p>
            <p className="mx-auto max-w-xl text-base leading-relaxed opacity-70">
              {PAGE_USE_NOTE}
            </p>
          </Reveal>
          <Reveal delay={0.15}>
            <p className="mx-auto mt-8 max-w-xl text-sm leading-relaxed italic opacity-50">
              {DONT_LOSE_IDEAS_NOTE}
            </p>
          </Reveal>
          <Reveal delay={0.3}>
            <p className="font-heading mx-auto mt-16 max-w-xl text-xl italic opacity-80">
              {FINAL_TEST_QUESTION}
            </p>
          </Reveal>
          <Reveal delay={0.4}>
            <p className="mx-auto mt-4 max-w-lg text-sm italic opacity-50">
              {FINAL_TEST_FAILURE_LINE}
            </p>
          </Reveal>
        </div>
      </ActShell>

      {/* ============================================================ */}
      {/* CLOSING */}
      {/* ============================================================ */}
      <ActShell
        tone="dark"
        className="flex min-h-[70svh] flex-col items-center justify-center gap-6 px-6 text-center"
      >
        <Reveal>
          <BigLine size="huge">Keep dreaming.</BigLine>
        </Reveal>
        <Reveal delay={0.25}>
          <Link
            href="/about/ideas-to-make-pages"
            className="flex items-center gap-1.5 rounded-full border border-current/20 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-current/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to the wall
          </Link>
        </Reveal>
        <Reveal delay={0.4}>
          <p className="mt-6 max-w-xs text-xs leading-relaxed italic opacity-30">
            This page is never finished. Add the 43rd personality. Add the dream
            you had this morning. — Idea Atlas
          </p>
        </Reveal>
      </ActShell>
    </main>
  );
}
