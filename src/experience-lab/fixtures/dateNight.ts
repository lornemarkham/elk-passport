import { answer, moment, nextWeekdayAt } from "./helpers";
import type { ExperienceDefinition } from "../core/types";

/**
 * **Fixture #4 — Date Night. The one that decides whether the engine is real.**
 *
 * If this had come out as Hockey Night with softer words, the primitives were
 * wrong. It did not, and the reason is worth recording precisely: *nothing
 * structural changed.* Date Night is the same engine with four switches
 * thrown —
 *
 * - no `scoring` on any prompt → the leaderboard block simply does not exist,
 *   because standings of an empty set is an empty array, not a zeroed table;
 * - `reveal: "onLock"` on the questions that matter → you answer, then you
 *   both see, which is a completely different feeling from watching a vote
 *   fill in;
 * - `reveal: "never"` on one → Passport is structurally unable to narrate it;
 * - `tone: "intimate"` → the same derived observation, phrased like a person
 *   rather than a broadcaster.
 *
 * There is no roster block, no feed of banter, and two participants. The
 * result reads as private. That is the strongest evidence in the lab that the
 * engine is not secretly a hockey engine.
 */

const ANCHOR = nextWeekdayAt(4, 19, 30); // Thursday, 7:30.

export const dateNight: ExperienceDefinition = {
  slug: "date-night",
  title: "Thursday",
  subtitle: "Just the two of you",
  kicker: "Somewhere neither of you has been",
  emoji: "🌙",
  palette: ["oklch(0.38 0.1 20)", "oklch(0.24 0.06 320)"],
  anchorAt: ANCHOR,
  hostId: "them",
  inviteLine: "Thursday. Just the two of you.",
  tone: "intimate",

  /**
   * **Three families, all at edge 0, and that is the entire bank.**
   *
   * This is the guardrail working exactly as designed. There is no
   * `prediction`, no `sealed`, no `dare`, no `vault`, no `groupquest`, no
   * `consequence` and no `people` bank — so the toy box opens on a date night
   * and offers three quiet things, because a fixture that writes nothing for a
   * family simply does not have that family.
   *
   * Nothing anywhere forbids a leaderboard on a date. The absence of anything
   * to score is what prevents it, which is a much better property than a rule.
   */
  starters: {
    mission: [
      {
        text: "Arrange one small thing tonight they are not expecting. Nothing expensive.",
        edge: 0,
        needsTarget: true,
      },
      {
        text: "Get them talking about something they have not thought about in years.",
        edge: 0,
        needsTarget: true,
      },
    ],
    photo: [{ text: "One photo tonight. Only one. Make it count.", edge: 0 }],
    ask: [
      { text: "Do you want to go somewhere after, or go home?", edge: 0 },
      { text: "Same place again, or somewhere new next time?", edge: 0 },
    ],
  },
  labNote:
    "The disproof fixture. Two people, no competition, no audience, privacy that the engine must be structurally incapable of violating.",

  phases: [
    {
      id: "before",
      label: "Before",
      headline: "Answer separately. You'll see each other's after.",
      offsetMinutes: -2880,
    },
    {
      id: "out",
      label: "Out",
      headline: "Phones down. This page will wait.",
      offsetMinutes: 0,
      // The most literal application of the whole principle, and the one that
      // required no argument at all.
      attention: "quiet",
    },
    {
      id: "after",
      label: "After",
      headline: "Keep one thing from tonight.",
      offsetMinutes: 240,
    },
  ],

  participants: [
    { id: "you", name: "You", emoji: "🌙", hue: 20, present: true },
    { id: "them", name: "Sam", emoji: "✨", hue: 320, present: true },
  ],

  prompts: [
    {
      id: "mood",
      question: "What do you actually want tonight?",
      kind: "choice",
      phaseId: "before",
      locksAtPhaseId: "out",
      reveal: "onLock",
      options: [
        {
          id: "quiet",
          label: "Quiet, and long",
          detail: "Somewhere we can hear each other",
          emoji: "🕯",
        },
        {
          id: "alive",
          label: "Somewhere alive",
          detail: "Noise, people, energy",
          emoji: "🎷",
        },
        { id: "new", label: "Something neither of us has done", emoji: "🎲" },
        { id: "home", label: "Honestly? Stay in", emoji: "🛋" },
      ],
    },
    {
      id: "surprise",
      question: "Do you want to know where we're going?",
      kind: "boolean",
      phaseId: "before",
      locksAtPhaseId: "out",
      reveal: "onLock",
    },
    {
      id: "three",
      question: "Passport found three. Pick one each — it books the overlap.",
      kind: "choice",
      phaseId: "before",
      locksAtPhaseId: "out",
      reveal: "onLock",
      options: [
        {
          id: "grapevine",
          label: "The back room at Grapevine",
          detail: "Eight tables, no music, they'll leave you alone",
          emoji: "🍷",
        },
        {
          id: "pier",
          label: "Late walk, then the pier bar",
          detail: "Cold, worth it",
          emoji: "🌊",
        },
        {
          id: "kitchen",
          label: "The chef's counter at Sable",
          detail: "Six seats, you watch it get made",
          emoji: "🔥",
        },
      ],
    },
    {
      id: "private",
      question: "One thing you're hoping for tonight",
      kind: "text",
      placeholder: "Only you will ever see this.",
      phaseId: "before",
      reveal: "never",
    },
    {
      id: "keep",
      question: "What are we keeping from tonight?",
      kind: "text",
      placeholder: "A line, a place, a thing that happened.",
      phaseId: "after",
      reveal: "onLock",
    },
  ],

  blocks: [
    {
      id: "choose",
      kind: "promptGroup",
      title: "Before Thursday",
      subtitle: "You each answer alone. Nothing shows until you've both gone.",
      phaseIds: ["before"],
      present: "deck",
      promptIds: ["mood", "surprise", "three", "private"],
      // The toy box is offered here specifically so the guardrail is
      // demonstrable rather than asserted: open it on a date and it has three
      // quiet things in it, because that is all this fixture wrote for.
      inviteOwnPrompt: {
        cta: "Add something for Thursday",
        hint: "Small. It doesn't have to be a whole plan.",
      },
    },
    {
      id: "panel",
      kind: "panel",
      title: "Thursday",
      phaseIds: ["out"],
      lines: [
        { label: "7:30", value: "The back room at Grapevine", emphasis: true },
        {
          label: "After",
          value: "The pier is a ten-minute walk and open until midnight",
        },
        { label: "Weather", value: "9°C, clear. Take the coat." },
      ],
    },
    {
      id: "memory",
      kind: "promptGroup",
      title: "After",
      phaseIds: ["after"],
      promptIds: ["keep"],
    },
    { id: "recap", kind: "recap", title: "Thursday", phaseIds: ["after"] },
  ],

  awards: [],

  seedResponses: [
    answer("mood", "them", "quiet", ANCHOR, 2000),
    answer("surprise", "them", false, ANCHOR, 2000),
    answer("three", "them", "grapevine", ANCHOR, 1990),
  ],

  seedMoments: [
    moment(ANCHOR, -2000, {
      kind: "voice",
      text: "Sam has answered. You haven't looked, and Passport hasn't shown you.",
    }),
    moment(ANCHOR, 200, {
      kind: "photo",
      by: "them",
      text: "the back room, nine o'clock",
      emoji: "🕯",
      keepsake: true,
    }),
  ],
};
