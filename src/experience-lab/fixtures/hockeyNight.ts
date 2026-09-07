import { answer, moment, nextWeekdayAt } from "./helpers";
import type { ExperienceDefinition } from "../core/types";

/**
 * **Fixture #1 — Sycle Hockey Night.**
 *
 * The specimen the engine was designed against, and therefore the one it is
 * most likely to be secretly shaped by. Everything invented here is
 * disclosed content, the same discipline as every other ELK Labs sandbox —
 * no real Atlas listing, no real venue hours, no real person.
 *
 * The thing this fixture exists to prove: the difference between "we're
 * going to a hockey game" and "holy shit, Friday" is almost entirely made of
 * *questions the group answers about each other*, not information about the
 * game.
 */

const ANCHOR = nextWeekdayAt(5, 19); // Friday, 7pm.

export const hockeyNight: ExperienceDefinition = {
  slug: "sycle-hockey-night",
  title: "Sycle Hockey Night",
  subtitle: "Canucks vs Flames",
  kicker: "Rogers Arena · Section 302",
  emoji: "🏒",
  palette: ["oklch(0.42 0.13 255)", "oklch(0.28 0.09 285)"],
  anchorAt: ANCHOR,
  whereLine: "Rogers Arena, Vancouver",
  hostId: "lorne",
  tone: "rowdy",
  labNote:
    "The specimen. Rowdy, competitive, many participants, a hard start time, and an appetite for stupidity.",

  phases: [
    {
      id: "before",
      label: "Before",
      headline: "Make Friday worse. Everyone gets a say.",
      offsetMinutes: -20160,
    },
    {
      id: "warmup",
      label: "Warm-up",
      headline: "Last call on picks. They lock at puck drop.",
      offsetMinutes: -90,
    },
    {
      id: "live",
      label: "Puck drop",
      headline: "Picks are locked. Nobody can save you now.",
      offsetMinutes: 0,
    },
    {
      id: "after",
      label: "Final horn",
      headline: "The horn is not the end of the night.",
      offsetMinutes: 165,
    },
    {
      id: "morning",
      label: "The morning after",
      headline: "What actually happened.",
      offsetMinutes: 900,
    },
    {
      id: "again",
      label: "Run it back",
      headline: "There is a next one. There is always a next one.",
      offsetMinutes: 20160,
    },
  ],

  participants: [
    {
      id: "lorne",
      name: "Lorne",
      emoji: "🧭",
      hue: 155,
      vibe: "Wants it interesting, not generic",
      present: true,
    },
    {
      id: "sarah",
      name: "Sarah",
      emoji: "🥂",
      hue: 340,
      vibe: "Would like actual food, please",
      present: true,
    },
    {
      id: "nathan",
      name: "Nathan",
      emoji: "🥅",
      hue: 250,
      vibe: "Suspiciously knows hockey",
      present: true,
    },
    {
      id: "dave",
      name: "Dave",
      emoji: "🎤",
      hue: 30,
      vibe: "Karaoke is on the table",
      present: true,
    },
    {
      id: "mike",
      name: "Mike",
      emoji: "🚕",
      hue: 200,
      vibe: "Refuses to walk more than 8 minutes",
      present: false,
    },
    {
      id: "priya",
      name: "Priya",
      emoji: "📸",
      hue: 95,
      vibe: "Will document everything",
      present: false,
    },
  ],

  prompts: [
    // ---- Pregame: a decision, not a competition. Reveals as it happens. ----
    {
      id: "pregame-spot",
      question: "Where are we going before?",
      kind: "choice",
      phaseId: "before",
      locksAtPhaseId: "warmup",
      reveal: "immediate",
      openToSuggestions: true,
      hint: "Add anywhere. Somebody will hate it.",
      options: [
        {
          id: "lions",
          label: "The Lion's Pub",
          detail: "4 min walk · loud · pub food",
          emoji: "🦁",
        },
        {
          id: "tap",
          label: "Tap & Barrel",
          detail: "6 min · patio · actual dinner",
          emoji: "🍺",
        },
        {
          id: "chambar",
          label: "Chambar",
          detail: "14 min · mussels · properly good",
          emoji: "🥘",
          addedBy: "sarah",
        },
        {
          id: "concourse",
          label: "Just eat in the concourse",
          detail: "0 min · $19 beer · zero effort",
          emoji: "🌭",
          addedBy: "dave",
        },
      ],
    },
    {
      id: "hard-out",
      question: "Be honest — when are you leaving?",
      kind: "choice",
      phaseId: "before",
      locksAtPhaseId: "live",
      reveal: "immediate",
      options: [
        { id: "horn", label: "Straight home at the horn", emoji: "🚪" },
        { id: "one", label: "One drink after", emoji: "🍻" },
        { id: "close", label: "Until they close", emoji: "🌙" },
        { id: "eleven", label: "Out by 11, no exceptions", emoji: "⏰" },
      ],
    },

    // ---- Picks: sealed until puck drop. This is the whole competition. ----
    {
      id: "final-score",
      question: "Final score",
      kind: "pair",
      pairLabels: ["Canucks", "Flames"],
      phaseId: "before",
      locksAtPhaseId: "live",
      resolvesAtPhaseId: "after",
      reveal: "onLock",
      resolution: [4, 3],
      scoring: {
        points: 5,
        label: "Exact score",
        partial: { points: 2, label: "Right winner" },
      },
    },
    {
      id: "first-team",
      question: "Who scores first?",
      kind: "choice",
      phaseId: "before",
      locksAtPhaseId: "live",
      resolvesAtPhaseId: "live",
      reveal: "onLock",
      resolution: "flames",
      scoring: { points: 3, label: "First goal" },
      options: [
        { id: "canucks", label: "Canucks", emoji: "🐋" },
        { id: "flames", label: "Flames", emoji: "🔥" },
      ],
    },
    {
      id: "overtime",
      question: "Does it go to overtime?",
      kind: "boolean",
      phaseId: "before",
      locksAtPhaseId: "live",
      resolvesAtPhaseId: "after",
      reveal: "onLock",
      resolution: false,
      scoring: { points: 3 },
    },
    {
      id: "total-goals",
      question: "Total goals, both teams",
      kind: "number",
      unit: "goals",
      phaseId: "before",
      locksAtPhaseId: "live",
      resolvesAtPhaseId: "after",
      reveal: "onLock",
      resolution: 7,
      scoring: { points: 3 },
    },

    // ---- The stupid ones. Asked by people, not by Passport. ----
    {
      id: "lorne-beer",
      question: "Will Lorne buy a $19 arena beer before puck drop?",
      askedBy: "sarah",
      kind: "boolean",
      phaseId: "before",
      locksAtPhaseId: "live",
      resolvesAtPhaseId: "live",
      reveal: "onLock",
      resolution: true,
      scoring: { points: 10, label: "Ridiculous longshot" },
    },
    {
      id: "refs",
      question: "First person to complain about the refs",
      askedBy: "nathan",
      kind: "person",
      phaseId: "before",
      locksAtPhaseId: "live",
      resolvesAtPhaseId: "live",
      reveal: "onLock",
      resolution: "mike",
      scoring: { points: 4 },
      options: [
        { id: "lorne", label: "Lorne", emoji: "🧭" },
        { id: "sarah", label: "Sarah", emoji: "🥂" },
        { id: "nathan", label: "Nathan", emoji: "🥅" },
        { id: "dave", label: "Dave", emoji: "🎤" },
        { id: "mike", label: "Mike", emoji: "🚕" },
        { id: "priya", label: "Priya", emoji: "📸" },
      ],
    },

    // ---- Postgame: a decision made in three taps while standing outside. ----
    {
      id: "postgame",
      question: "So. Where are we going?",
      kind: "choice",
      phaseId: "after",
      reveal: "immediate",
      openToSuggestions: true,
      hint: "Yes, Dave, you can suggest karaoke again.",
      options: [
        {
          id: "keep",
          label: "Keep going",
          detail: "Somewhere loud, still open",
          emoji: "🔊",
        },
        {
          id: "food",
          label: "Food, immediately",
          detail: "Nobody has eaten since 5",
          emoji: "🍜",
        },
        {
          id: "one-last",
          label: "One last drink",
          detail: "The lie we tell every time",
          emoji: "🥃",
        },
        {
          id: "cooked",
          label: "We're cooked — get us home",
          detail: "No shame",
          emoji: "🛌",
        },
      ],
    },
  ],

  blocks: [
    {
      id: "roster",
      kind: "roster",
      title: "Who's in",
      phaseIds: ["before", "warmup", "live", "after"],
    },
    {
      id: "pregame",
      kind: "promptGroup",
      title: "Before the game",
      subtitle:
        "Suggest anywhere. Everyone votes. Loudest opinion does not win.",
      phaseIds: ["before", "warmup"],
      promptIds: ["pregame-spot", "hard-out"],
    },
    {
      id: "picks",
      kind: "promptGroup",
      title: "Your picks",
      subtitle:
        "Sealed until puck drop. No money, no gambling — purely so you can be insufferable about it later.",
      phaseIds: ["before", "warmup", "live"],
      promptIds: [
        "final-score",
        "first-team",
        "overtime",
        "total-goals",
        "lorne-beer",
        "refs",
      ],
      inviteOwnPrompt: {
        cta: "Ask the group something stupid",
        hint: "The best question of the night has never once come from us.",
      },
    },
    {
      id: "postgame-block",
      kind: "promptGroup",
      title: "The night is not over",
      phaseIds: ["after"],
      promptIds: ["postgame"],
    },
    {
      id: "recap",
      kind: "recap",
      title: "Sycle Hockey Night",
      phaseIds: ["morning", "again"],
    },
    {
      id: "cup",
      kind: "leaderboard",
      title: "The Sycle Cup",
      subtitle: "Worth nothing. Contested bitterly.",
      phaseIds: ["live", "after", "morning", "again"],
    },
    {
      id: "feed",
      kind: "feed",
      title: "The night",
      phaseIds: ["before", "warmup", "live", "after", "morning", "again"],
    },
    {
      id: "again",
      kind: "runItBack",
      title: "Run it back",
      phaseIds: ["again"],
    },
  ],

  awards: [
    {
      id: "champ",
      label: "Sycle Cup Champion",
      emoji: "🏆",
      basis: "top",
      blurb: "Insufferable until the next one.",
    },
    {
      id: "potato",
      label: "Passport Potato",
      emoji: "🥔",
      basis: "bottom",
      blurb: "Somebody has to be.",
    },
    {
      id: "prophet",
      label: "Prophet of the Night",
      emoji: "🎯",
      basis: "mostExact",
      blurb: "Called it exactly.",
    },
    {
      id: "clown",
      label: "Boldest Wrong Opinion",
      emoji: "🤡",
      basis: "boldest",
      blurb: "Went somewhere nobody followed.",
    },
  ],

  seedResponses: [
    answer("pregame-spot", "lorne", "lions", ANCHOR, 4300),
    answer("pregame-spot", "dave", "concourse", ANCHOR, 4200),
    answer("pregame-spot", "sarah", "chambar", ANCHOR, 4100),
    answer("pregame-spot", "nathan", "lions", ANCHOR, 3900),
    answer("hard-out", "sarah", "eleven", ANCHOR, 3800),
    answer("hard-out", "dave", "close", ANCHOR, 3700),
    answer("hard-out", "lorne", "one", ANCHOR, 3600),
    answer("hard-out", "nathan", "one", ANCHOR, 3500),

    answer("final-score", "nathan", [3, 0], ANCHOR, 3000),
    answer("final-score", "lorne", [4, 2], ANCHOR, 2900),
    answer("final-score", "sarah", [2, 1], ANCHOR, 2800),
    answer("final-score", "dave", [7, 1], ANCHOR, 2700),
    answer("first-team", "nathan", "canucks", ANCHOR, 3000),
    answer("first-team", "lorne", "canucks", ANCHOR, 2900),
    answer("first-team", "sarah", "flames", ANCHOR, 2800),
    answer("first-team", "dave", "canucks", ANCHOR, 2700),
    answer("overtime", "nathan", false, ANCHOR, 3000),
    answer("overtime", "lorne", true, ANCHOR, 2900),
    answer("overtime", "sarah", false, ANCHOR, 2800),
    answer("overtime", "dave", true, ANCHOR, 2700),
    answer("total-goals", "nathan", 3, ANCHOR, 3000),
    answer("total-goals", "lorne", 6, ANCHOR, 2900),
    answer("total-goals", "sarah", 5, ANCHOR, 2800),
    answer("total-goals", "dave", 8, ANCHOR, 2700),
    answer("lorne-beer", "sarah", true, ANCHOR, 2600),
    answer("lorne-beer", "nathan", true, ANCHOR, 2500),
    answer("lorne-beer", "dave", true, ANCHOR, 2400),
    answer("lorne-beer", "lorne", false, ANCHOR, 2300),
    answer("refs", "sarah", "mike", ANCHOR, 2600),
    answer("refs", "dave", "nathan", ANCHOR, 2500),
    answer("refs", "nathan", "dave", ANCHOR, 2400),
    answer("refs", "lorne", "mike", ANCHOR, 2300),
  ],

  seedMoments: [
    moment(ANCHOR, -20140, {
      kind: "note",
      by: "lorne",
      text: "Tickets are in. Section 302, row 8. Everyone's in the same block.",
    }),
    moment(ANCHOR, -20120, {
      kind: "note",
      by: "dave",
      text: "Karaoke afterward?",
      reactions: { "😂": ["sarah", "nathan"], "🙅": ["sarah"] },
    }),
    moment(ANCHOR, -20110, {
      kind: "note",
      by: "sarah",
      text: "Absolutely not, Dave.",
    }),
    moment(ANCHOR, -20050, {
      kind: "note",
      by: "sarah",
      text: "I've added a question. Lorne knows what he did last time.",
    }),
    moment(ANCHOR, -60, {
      kind: "voice",
      text: "Picks lock in one hour. Two of you have submitted nothing, which we are choosing to interpret as fear.",
    }),
    moment(ANCHOR, 0, {
      kind: "voice",
      text: "🏒 Puck drop. Picks are locked.",
    }),
    moment(ANCHOR, 12, {
      kind: "result",
      emoji: "🔥",
      text: "Flames open the scoring. 0–1.",
      keepsake: true,
    }),
    moment(ANCHOR, 14, {
      kind: "voice",
      text: "Nathan's shutout prediction survived 4 minutes and 13 seconds.",
    }),
    moment(ANCHOR, 21, {
      kind: "note",
      by: "mike",
      text: "that was offside and everyone in this building knows it",
      reactions: { "😂": ["lorne", "sarah", "dave"] },
    }),
    moment(ANCHOR, 22, {
      kind: "voice",
      text: "Sarah and Lorne both called Mike as the first to complain about the refs. It took him 21 minutes.",
    }),
    moment(ANCHOR, 38, {
      kind: "result",
      emoji: "🐋",
      text: "Canucks answer. 1–1.",
    }),
    moment(ANCHOR, 47, {
      kind: "photo",
      by: "priya",
      text: "the boys, deeply invested",
      emoji: "📸",
      keepsake: true,
    }),
    moment(ANCHOR, 96, {
      kind: "result",
      emoji: "🐋",
      text: "3–2 Canucks. Section 302 is standing.",
    }),
    moment(ANCHOR, 150, {
      kind: "result",
      emoji: "🚨",
      text: "Empty netter. 4–3 final.",
      keepsake: true,
    }),
    moment(ANCHOR, 152, {
      kind: "voice",
      text: "Dave predicted 7–1 and a hat trick. The matter has been referred to an independent commission.",
    }),
    moment(ANCHOR, 240, {
      kind: "note",
      by: "priya",
      text: "34 photos. Three of them are usable.",
      keepsake: true,
    }),
  ],

  lineage: {
    previousLabel: "Sycle Hockey Night · last March",
    defendingChampionId: "sarah",
    standing: [
      { participantId: "sarah", points: 16 },
      { participantId: "nathan", points: 14 },
      { participantId: "lorne", points: 9 },
      { participantId: "dave", points: 2 },
    ],
    callback:
      "Sarah won last time on a single lucky overtime call and has not stopped mentioning it.",
  },
};
