import { answer, moment, nextWeekdayAt } from "./helpers";
import type { ExperienceDefinition } from "../core/types";

/**
 * **Fixture #3 — Christmas Light-Up.**
 *
 * Included because it is the only fixture with *many anchors inside one
 * evening*, and that is what it was written to break. A hockey game has one
 * puck drop; a light-up has a choir at 5:20, a switch at 6:00 and a fireworks
 * finish at 8:00, and missing any of them is the failure mode.
 *
 * The phase model held, but only by treating each "don't miss" moment as a
 * phase, which makes the phase list long and makes `headline` do work it was
 * not designed for. Recorded in README as a real strain, not a success.
 *
 * Also the first fixture with children in it, which is why the scored prompts
 * are photo-and-spotting challenges rather than predictions: a seven-year-old
 * cannot predict a score, but can absolutely find a brass band.
 */

const ANCHOR = nextWeekdayAt(6, 17, 0); // Saturday, 5pm.

export const christmasLightUp: ExperienceDefinition = {
  slug: "christmas-light-up",
  title: "Light-Up",
  subtitle: "Downtown · the whole family",
  kicker: "Saturday from 5pm",
  emoji: "🎄",
  palette: ["oklch(0.36 0.1 150)", "oklch(0.24 0.06 20)"],
  anchorAt: ANCHOR,
  whereLine: "Main Street & the square",
  hostId: "lorne",
  tone: "warm",

  /**
   * The bank that tested whether the toys survive children.
   *
   * No `dare`, no `consequence`, no `vault` — a seven-year-old submitting a
   * photo into a sealed contest she cannot see the result of for two hours is
   * a bad time. What is here instead is finding, photographing and
   * remembering, and everything is edge 0. A fixture opting out of a family by
   * simply not writing for it stayed the cheapest safety mechanism in the lab.
   */
  starters: {
    sidequest: [
      {
        text: "Find something red, something gold and something ridiculous.",
        edge: 0,
      },
      { text: "Find the biggest candy cane in the square.", edge: 0 },
      { text: "Find a dog wearing something festive.", edge: 0 },
      { text: "Find a window with more than fifty lights in it.", edge: 0 },
    ],
    photo: [
      {
        text: "Best photo of somebody's face when the lights come on.",
        edge: 0,
      },
      { text: "The whole family, badly, in front of the tree.", edge: 0 },
      { text: "Best photo Emi takes all night.", edge: 0 },
    ],
    groupquest: [
      {
        text: "All of us in one photo with the tree, before the fireworks.",
        edge: 0,
      },
      { text: "Everybody holding something from a different stall.", edge: 0 },
    ],
    mission: [
      {
        text: "Get one hot chocolate for somebody without them noticing you went.",
        edge: 0,
        needsTarget: true,
      },
      {
        text: "Find out from Gran one thing about this event nobody else knows.",
        edge: 0,
        needsTarget: true,
      },
    ],
    prediction: [
      { text: "Somebody cries at the countdown. It is an adult.", edge: 0 },
      { text: "The doughnut cart sells out before seven.", edge: 0 },
    ],
    people: [{ text: "Your best Christmas memory, in one line.", edge: 0 }],
    ask: [{ text: "Are we staying for the fireworks or going home?", edge: 0 }],
  },
  labNote:
    "Many anchors in one evening, mixed ages, and a scavenger hunt instead of predictions. Strains the phase model — see README.",

  phases: [
    {
      id: "before",
      label: "Before Saturday",
      headline: "Nine people, one evening, four things you cannot miss.",
      offsetMinutes: -4320,
    },
    {
      id: "arrive",
      label: "5:00 · Arrive",
      headline: "Find each other. The square fills fast.",
      offsetMinutes: 0,
    },
    {
      id: "choir",
      label: "5:20 · Choir",
      headline: "Twenty minutes, by the fountain.",
      offsetMinutes: 20,
    },
    {
      id: "switch",
      label: "6:00 · The switch",
      headline: "This is the bit. Get the kids to the front.",
      offsetMinutes: 60,
      // The one moment of the entire evening. Nobody should be holding a phone
      // for a leaderboard while it happens.
      attention: "quiet",
    },
    {
      id: "wander",
      label: "After",
      headline: "Eat something. Find the rest of the list.",
      offsetMinutes: 80,
    },
    {
      id: "home",
      label: "Home",
      headline: "Everyone is asleep in the car.",
      offsetMinutes: 240,
    },
  ],

  participants: [
    { id: "lorne", name: "Lorne", emoji: "🧭", hue: 155, present: true },
    { id: "kate", name: "Kate", emoji: "🌾", hue: 100, present: true },
    {
      id: "emi",
      name: "Emi (7)",
      emoji: "⭐️",
      hue: 60,
      vibe: "Here for the doughnuts",
      present: true,
    },
    {
      id: "gran",
      name: "Gran",
      emoji: "🫖",
      hue: 340,
      vibe: "Has been to 41 of these",
      present: true,
    },
    { id: "ben", name: "Ben", emoji: "🧣", hue: 220, present: false },
  ],

  prompts: [
    {
      id: "meet",
      question: "Where do we meet? It gets packed by 5.",
      kind: "choice",
      phaseId: "before",
      locksAtPhaseId: "arrive",
      reveal: "immediate",
      openToSuggestions: true,
      hint: "Somewhere a seven-year-old can find.",
      options: [
        {
          id: "clock",
          label: "Under the clock",
          detail: "Gran's suggestion. Gran is usually right.",
          emoji: "🕰",
          addedBy: "gran",
        },
        {
          id: "library",
          label: "Library steps",
          detail: "Quieter, 3 min from the square",
          emoji: "📚",
        },
        { id: "lot", label: "The parkade, level 2", emoji: "🅿️" },
      ],
    },
    {
      id: "food",
      question: "Dinner, and be realistic",
      kind: "choice",
      phaseId: "before",
      locksAtPhaseId: "switch",
      reveal: "immediate",
      options: [
        { id: "before", label: "Eat properly first", emoji: "🍽" },
        { id: "street", label: "Whatever's on the street", emoji: "🌭" },
        { id: "after", label: "Hold out until after", emoji: "🕗" },
      ],
    },
    {
      id: "hunt-band",
      question: "Find the brass band and photograph it",
      kind: "boolean",
      phaseId: "arrive",
      reveal: "immediate",
      resolvesAtPhaseId: "arrive",
      resolution: true,
      scoring: { points: 3, label: "Found it" },
    },
    {
      id: "hunt-reindeer",
      question: "Somebody is dressed as a reindeer. Find them.",
      kind: "boolean",
      phaseId: "arrive",
      reveal: "immediate",
      resolvesAtPhaseId: "wander",
      resolution: true,
      scoring: { points: 3, label: "Found it" },
    },
    {
      id: "hunt-window",
      question: "The best decorated window on Main",
      kind: "text",
      placeholder: "Name the shop.",
      phaseId: "wander",
      reveal: "immediate",
    },
    {
      id: "countdown",
      question: "Who gets to do the countdown with Emi?",
      askedBy: "emi",
      kind: "person",
      phaseId: "before",
      locksAtPhaseId: "switch",
      reveal: "immediate",
      options: [
        { id: "lorne", label: "Dad", emoji: "🧭" },
        { id: "kate", label: "Mum", emoji: "🌾" },
        { id: "gran", label: "Gran", emoji: "🫖" },
      ],
    },
    {
      id: "best-bit",
      question: "Best bit of the night",
      kind: "text",
      placeholder: "One line. Emi gets a vote too.",
      phaseId: "home",
      reveal: "immediate",
    },
  ],

  blocks: [
    {
      id: "roster",
      kind: "roster",
      title: "The whole lot of us",
      phaseIds: ["before", "arrive", "choir", "switch", "wander", "home"],
    },
    {
      id: "schedule",
      kind: "panel",
      title: "Don't miss",
      subtitle: "Gran has been to 41 of these and this is her list.",
      phaseIds: ["before", "arrive", "choir", "switch", "wander"],
      lines: [
        { label: "5:20", value: "Choir by the fountain — twenty minutes only" },
        {
          label: "6:00",
          value: "The switch. Be at the front by 5:50.",
          emphasis: true,
        },
        { label: "6:30", value: "Doughnut cart by the bank. Sells out." },
        { label: "8:00", value: "Fireworks off the roof of the Mercantile" },
      ],
    },
    {
      id: "plan",
      kind: "promptGroup",
      title: "Before Saturday",
      phaseIds: ["before"],
      present: "deck",
      promptIds: ["meet", "food", "countdown"],
    },
    {
      id: "hunt",
      kind: "promptGroup",
      title: "The list",
      subtitle:
        "Find them, photograph them, tick them off. Emi is keeping score.",
      phaseIds: ["arrive", "choir", "switch", "wander"],
      promptIds: ["hunt-band", "hunt-reindeer", "hunt-window"],
      inviteOwnPrompt: {
        cta: "Add something to find",
        hint: "Kids write better ones than we do.",
      },
    },
    {
      id: "board",
      kind: "leaderboard",
      title: "Emi's scoreboard",
      subtitle: "Emi is keeping score and Emi does not accept appeals.",
      phaseIds: ["switch", "wander", "home"],
    },
    {
      id: "night",
      kind: "promptGroup",
      title: "Before bed",
      phaseIds: ["home"],
      promptIds: ["best-bit"],
    },
    { id: "recap", kind: "recap", title: "Light-Up", phaseIds: ["home"] },
    {
      id: "feed",
      kind: "feed",
      title: "Saturday",
      phaseIds: ["before", "arrive", "choir", "switch", "wander", "home"],
    },
    { id: "again", kind: "runItBack", title: "Next year", phaseIds: ["home"] },
  ],

  awards: [
    {
      id: "spotter",
      label: "Chief Spotter",
      emoji: "🔦",
      basis: "top",
      blurb: "Found the most.",
    },
    {
      id: "eyes",
      label: "Sharpest Eyes",
      emoji: "⭐️",
      basis: "mostExact",
      blurb: "Didn't miss one.",
    },
  ],

  seedResponses: [
    answer("meet", "gran", "clock", ANCHOR, 4000),
    answer("meet", "kate", "clock", ANCHOR, 3900),
    answer("food", "kate", "before", ANCHOR, 3800),
    answer("food", "emi", "street", ANCHOR, 3700),
    answer("countdown", "emi", "gran", ANCHOR, 3600),
    answer("countdown", "kate", "gran", ANCHOR, 3500),
    answer("hunt-band", "emi", true, ANCHOR, -10),
    answer("hunt-reindeer", "emi", true, ANCHOR, -15),
    answer("hunt-band", "gran", true, ANCHOR, -12),
  ],

  seedMoments: [
    moment(ANCHOR, -4100, {
      kind: "note",
      by: "gran",
      text: "Under the clock. It has been under the clock since 1984.",
      reactions: { "❤️": ["kate", "lorne"] },
    }),
    moment(ANCHOR, 22, {
      kind: "photo",
      by: "emi",
      text: "the band!!!",
      emoji: "🎺",
      keepsake: true,
    }),
    moment(ANCHOR, 61, {
      kind: "result",
      emoji: "✨",
      text: "Lights on. The whole square made the same noise.",
      keepsake: true,
    }),
    moment(ANCHOR, 95, {
      kind: "note",
      by: "kate",
      text: "Doughnut cart sold out at 6:40. Gran called it.",
    }),
  ],
};
