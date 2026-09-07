import { answer, moment, nextWeekdayAt } from "./helpers";
import type { ExperienceDefinition } from "../core/types";

/**
 * **Fixture #2 — Powder Day.**
 *
 * Written to break the engine in three specific ways, and it broke it in one.
 *
 * - *No fixed start.* A powder day begins when the snow says so, so the
 *   anchor is "first chair" and the interesting phase is the one before it,
 *   where the only question is whether this is happening at all.
 * - *Conditions are content.* A `panel` block carries facts the group did not
 *   author — the shape Atlas will eventually fill.
 * - *Competition without a scoreboard of predictions.* The scored questions
 *   here resolve from what people did, not from what a world event decided,
 *   and one of them ("run of the day") is voted on rather than resolved.
 *
 * What broke: a vote that decides an award is not the same as a prediction
 * that is graded. See README — "resolution by vote" is an open question.
 */

const ANCHOR = nextWeekdayAt(6, 8, 30); // Saturday, first chair.

export const powderDay: ExperienceDefinition = {
  slug: "powder-day",
  title: "Powder Day",
  subtitle: "Big White · 31cm overnight",
  kicker: "First chair 8:30",
  emoji: "🎿",
  palette: ["oklch(0.55 0.09 235)", "oklch(0.32 0.06 265)"],
  anchorAt: ANCHOR,
  whereLine: "Big White, Okanagan",
  hostId: "lorne",
  tone: "hype",
  labNote:
    "Conditions-driven and half-spontaneous. Tests whether the engine survives an experience with no ticket, no fixed start, and facts nobody in the group wrote.",

  phases: [
    {
      id: "maybe",
      label: "Is this happening?",
      headline: "31cm overnight. Somebody has to say it out loud.",
      offsetMinutes: -900,
    },
    {
      id: "dawn",
      label: "Dawn patrol",
      headline: "Alarms are set. Last chance to bail honourably.",
      offsetMinutes: -150,
    },
    {
      id: "onhill",
      label: "On the hill",
      headline: "Go ski. Come back when your legs quit.",
      offsetMinutes: 0,
    },
    {
      id: "apres",
      label: "Après",
      headline: "Boots off. Settle it.",
      offsetMinutes: 420,
    },
    {
      id: "after",
      label: "Monday",
      headline: "Nobody at work needs to know.",
      offsetMinutes: 2400,
    },
  ],

  participants: [
    {
      id: "lorne",
      name: "Lorne",
      emoji: "🧭",
      hue: 155,
      vibe: "Will drive",
      present: true,
    },
    {
      id: "jess",
      name: "Jess",
      emoji: "🏔",
      hue: 210,
      vibe: "Faster than everyone",
      present: true,
    },
    {
      id: "tom",
      name: "Tom",
      emoji: "🥶",
      hue: 40,
      vibe: "Owns no waterproof gloves",
      present: true,
    },
    {
      id: "ari",
      name: "Ari",
      emoji: "📹",
      hue: 300,
      vibe: "Films everything, skis nothing",
      present: false,
    },
  ],

  prompts: [
    {
      id: "in-or-out",
      question: "Are you in?",
      kind: "choice",
      phaseId: "maybe",
      locksAtPhaseId: "onhill",
      reveal: "immediate",
      options: [
        { id: "in", label: "I'm in", detail: "Obviously", emoji: "🙌" },
        { id: "late", label: "In, but not for first chair", emoji: "😴" },
        { id: "out", label: "Can't", detail: "Say it quietly", emoji: "😞" },
      ],
    },
    {
      id: "meet",
      question: "Where are we meeting?",
      kind: "choice",
      phaseId: "dawn",
      locksAtPhaseId: "onhill",
      reveal: "immediate",
      openToSuggestions: true,
      hint: "Add a lift, a lot, a coffee place.",
      options: [
        { id: "bullwheel", label: "Bottom of the Bullwheel", emoji: "🎡" },
        { id: "lot", label: "Happy Valley lot", emoji: "🅿️" },
        { id: "coffee", label: "Coffee first, obviously", emoji: "☕️" },
      ],
    },
    {
      id: "first-run",
      question: "First run — call it now",
      kind: "choice",
      phaseId: "dawn",
      locksAtPhaseId: "onhill",
      resolvesAtPhaseId: "onhill",
      reveal: "onLock",
      resolution: "cliff",
      scoring: { points: 3, label: "Called the line" },
      options: [
        { id: "cliff", label: "Cliff Chair trees", emoji: "🌲" },
        { id: "gem", label: "Gem Lake", emoji: "💎" },
        { id: "parachute", label: "Parachute Bowl", emoji: "🪂" },
      ],
    },
    {
      id: "vertical",
      question: "How many runs before somebody quits?",
      kind: "number",
      unit: "runs",
      phaseId: "dawn",
      locksAtPhaseId: "onhill",
      resolvesAtPhaseId: "apres",
      reveal: "onLock",
      resolution: 11,
      scoring: { points: 4 },
    },
    {
      id: "yardsale",
      question: "Who eats it first, and hardest?",
      askedBy: "jess",
      kind: "person",
      phaseId: "dawn",
      locksAtPhaseId: "onhill",
      resolvesAtPhaseId: "apres",
      reveal: "onLock",
      resolution: "tom",
      scoring: { points: 6, label: "The yard sale" },
      options: [
        { id: "lorne", label: "Lorne", emoji: "🧭" },
        { id: "jess", label: "Jess", emoji: "🏔" },
        { id: "tom", label: "Tom", emoji: "🥶" },
        { id: "ari", label: "Ari", emoji: "📹" },
      ],
    },
    {
      id: "run-of-day",
      question: "Run of the day",
      kind: "choice",
      phaseId: "apres",
      reveal: "immediate",
      openToSuggestions: true,
      hint: "Name the run. Argue about it.",
      options: [
        {
          id: "cliff-trees",
          label: "Cliff trees, second lap",
          detail: "Untouched, waist deep",
          emoji: "🌲",
        },
        { id: "sundance", label: "Sun-Rype Bowl at 11", emoji: "☀️" },
      ],
    },
  ],

  blocks: [
    {
      id: "roster",
      kind: "roster",
      title: "Who's coming",
      phaseIds: ["maybe", "dawn", "onhill", "apres", "after"],
    },
    {
      id: "conditions",
      kind: "panel",
      title: "This morning",
      subtitle:
        "Not written by anyone here. This is the shape Atlas eventually fills.",
      phaseIds: ["maybe", "dawn", "onhill"],
      lines: [
        { label: "Overnight", value: "31 cm", emphasis: true },
        { label: "Base", value: "184 cm" },
        { label: "Temp at village", value: "−7°C" },
        { label: "Wind", value: "Light, from the SW" },
        {
          label: "Lifts",
          value: "Bullwheel & Gem on time; Cliff on wind hold",
        },
        { label: "Road", value: "Plowed, winter tires required" },
      ],
    },
    {
      id: "call",
      kind: "promptGroup",
      title: "The call",
      phaseIds: ["maybe"],
      promptIds: ["in-or-out"],
    },
    {
      id: "plan",
      kind: "promptGroup",
      title: "Before first chair",
      phaseIds: ["dawn"],
      promptIds: ["meet", "first-run", "vertical", "yardsale"],
      inviteOwnPrompt: {
        cta: "Add a dare",
        hint: "Somebody is going to do it anyway.",
      },
    },
    {
      id: "apres-vote",
      kind: "promptGroup",
      title: "Après",
      phaseIds: ["apres"],
      promptIds: ["run-of-day"],
    },
    { id: "recap", kind: "recap", title: "Powder Day", phaseIds: ["after"] },
    {
      id: "board",
      kind: "leaderboard",
      title: "Standings",
      subtitle: "Bragging rights only.",
      phaseIds: ["apres", "after"],
    },
    {
      id: "feed",
      kind: "feed",
      title: "The day",
      phaseIds: ["maybe", "dawn", "onhill", "apres", "after"],
    },
    {
      id: "again",
      kind: "runItBack",
      title: "Next storm",
      phaseIds: ["after"],
    },
  ],

  awards: [
    {
      id: "champ",
      label: "Called It",
      emoji: "🏔",
      basis: "top",
      blurb: "Read the mountain correctly.",
    },
    {
      id: "yard",
      label: "Yard Sale of the Day",
      emoji: "🎿",
      basis: "bottom",
      blurb: "Gear recovered, dignity not.",
    },
    {
      id: "bold",
      label: "Went First",
      emoji: "🫡",
      basis: "boldest",
      blurb: "Dropped in before anyone else would.",
    },
  ],

  seedResponses: [
    answer("in-or-out", "jess", "in", ANCHOR, 860),
    answer("in-or-out", "lorne", "in", ANCHOR, 840),
    answer("in-or-out", "tom", "late", ANCHOR, 700),
    answer("meet", "jess", "bullwheel", ANCHOR, 200),
    answer("meet", "lorne", "coffee", ANCHOR, 190),
    answer("first-run", "jess", "cliff", ANCHOR, 180),
    answer("first-run", "lorne", "gem", ANCHOR, 175),
    answer("first-run", "tom", "gem", ANCHOR, 170),
    answer("vertical", "jess", 14, ANCHOR, 180),
    answer("vertical", "lorne", 11, ANCHOR, 175),
    answer("vertical", "tom", 6, ANCHOR, 170),
    answer("yardsale", "jess", "tom", ANCHOR, 180),
    answer("yardsale", "lorne", "tom", ANCHOR, 175),
    answer("yardsale", "tom", "lorne", ANCHOR, 170),
    answer("run-of-day", "jess", "cliff-trees", ANCHOR, -430),
    answer("run-of-day", "lorne", "cliff-trees", ANCHOR, -440),
  ],

  seedMoments: [
    moment(ANCHOR, -880, {
      kind: "voice",
      text: "31 cm overnight and the Cliff Chair is on a wind hold. This is a decision, not a plan.",
    }),
    moment(ANCHOR, -870, {
      kind: "note",
      by: "jess",
      text: "I'm going regardless. Ride or don't.",
      reactions: { "🔥": ["lorne", "tom"] },
    }),
    moment(ANCHOR, -120, {
      kind: "note",
      by: "tom",
      text: "my gloves are still wet from last week",
    }),
    moment(ANCHOR, 15, {
      kind: "result",
      emoji: "🌲",
      text: "Cliff Chair opened. Trees are untouched.",
      keepsake: true,
    }),
    moment(ANCHOR, 95, {
      kind: "photo",
      by: "ari",
      text: "Jess, waist deep, absolutely gone",
      emoji: "📹",
      keepsake: true,
    }),
    moment(ANCHOR, 140, {
      kind: "result",
      emoji: "🎿",
      text: "Tom yard-saled on the traverse. Ski located 40m downhill.",
      keepsake: true,
    }),
    moment(ANCHOR, 400, {
      kind: "voice",
      text: "Eleven runs. Tom called six and was, in fairness, describing himself.",
    }),
  ],
};
