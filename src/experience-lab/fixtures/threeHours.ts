import { moment } from "./helpers";
import type { ExperienceDefinition } from "../core/types";

/**
 * **Fixture #5 — "We have three hours."**
 *
 * No anchor event exists. This is the hardest case and the one the lab is
 * least finished on: the experience has to be *discovered* before it can be
 * escalated.
 *
 * What it revealed: an experience with nothing at its centre still has a
 * shape, because the first phase's job is to produce the centre. The prompts
 * here are not about a night — they are about the people, and their answers
 * are what a recommendation would be built from. The three candidate
 * afternoons in the panel are hard-coded, and that is exactly the seam where
 * Atlas belongs: today a human wrote them, tomorrow Atlas proposes them from
 * the same answers.
 *
 * Honest status: the hand-off from "we chose one" to "that is now the
 * experience" is not built. See README, open question 3.
 */

const ANCHOR = new Date(Date.now() + 45 * 60_000).toISOString();

export const threeHours: ExperienceDefinition = {
  slug: "three-hours",
  title: "We have three hours",
  subtitle: "Nothing planned. That's the point.",
  kicker: "Right now · Okanagan",
  emoji: "🕒",
  palette: ["oklch(0.5 0.11 65)", "oklch(0.3 0.07 40)"],
  anchorAt: ANCHOR,
  hostId: "lorne",
  tone: "warm",
  labNote:
    "No anchor event. Tests whether the engine can discover an experience rather than escalate one. Partially answered — see README.",

  phases: [
    {
      id: "open",
      label: "Open",
      headline: "Three hours and no plan. Answer four things.",
      offsetMinutes: -45,
    },
    {
      id: "chosen",
      label: "Decided",
      headline: "That's the afternoon. Go.",
      offsetMinutes: 0,
    },
    {
      id: "after",
      label: "After",
      headline: "Worth doing again?",
      offsetMinutes: 180,
    },
  ],

  participants: [
    { id: "lorne", name: "Lorne", emoji: "🧭", hue: 155, present: true },
    { id: "kate", name: "Kate", emoji: "🌾", hue: 100, present: true },
    { id: "sam", name: "Sam", emoji: "🚲", hue: 240, present: false },
  ],

  prompts: [
    {
      id: "energy",
      question: "How much are we willing to do?",
      kind: "choice",
      phaseId: "open",
      locksAtPhaseId: "chosen",
      reveal: "immediate",
      options: [
        { id: "sit", label: "Sit somewhere good", emoji: "☕️" },
        { id: "walk", label: "Move a bit", emoji: "🚶" },
        { id: "go", label: "Actually do something", emoji: "🥾" },
      ],
    },
    {
      id: "radius",
      question: "How far are we prepared to drive?",
      kind: "choice",
      phaseId: "open",
      locksAtPhaseId: "chosen",
      reveal: "immediate",
      options: [
        { id: "here", label: "Walking distance", emoji: "📍" },
        { id: "twenty", label: "20 minutes", emoji: "🚗" },
        { id: "hour", label: "An hour, if it's worth it", emoji: "🛣" },
      ],
    },
    {
      id: "known",
      question: "New, or something we already love?",
      kind: "choice",
      phaseId: "open",
      locksAtPhaseId: "chosen",
      reveal: "immediate",
      options: [
        { id: "new", label: "Somewhere new", emoji: "🧭" },
        { id: "known", label: "The one we always go to", emoji: "🫶" },
      ],
    },
    {
      id: "pick",
      question: "Three afternoons. Pick one.",
      kind: "choice",
      phaseId: "open",
      locksAtPhaseId: "chosen",
      reveal: "immediate",
      openToSuggestions: true,
      hint: "Or propose your own and see if anyone bites.",
      options: [
        {
          id: "kalamalka",
          label: "Kalamalka lookout, then the bakery in Coldstream",
          detail: "42 min · one steep bit · back by 5",
          emoji: "🏞",
        },
        {
          id: "bench",
          label: "Three tasting rooms on the Naramata bench",
          detail: "Somebody isn't drinking · 55 min",
          emoji: "🍇",
        },
        {
          id: "market",
          label: "The Wednesday market, then the pier",
          detail: "12 min · nothing is required of you",
          emoji: "🍑",
        },
      ],
    },
  ],

  blocks: [
    {
      id: "roster",
      kind: "roster",
      title: "Us",
      phaseIds: ["open", "chosen", "after"],
    },
    {
      id: "narrow",
      kind: "promptGroup",
      title: "Four questions",
      subtitle: "This is the whole planning step. There is no form.",
      phaseIds: ["open"],
      promptIds: ["energy", "radius", "known", "pick"],
    },
    {
      id: "chosen-panel",
      kind: "panel",
      title: "Kalamalka lookout",
      subtitle: "Chosen by the group. Everything below would come from Atlas.",
      phaseIds: ["chosen"],
      lines: [
        { label: "Drive", value: "42 minutes from here", emphasis: true },
        { label: "The walk", value: "1.8 km, one steep section, gravel" },
        { label: "Light", value: "Sunset at 6:12 — the lookout faces west" },
        { label: "After", value: "The bakery in Coldstream closes at 5" },
      ],
    },
    { id: "recap", kind: "recap", title: "Three hours", phaseIds: ["after"] },
    {
      id: "feed",
      kind: "feed",
      title: "This afternoon",
      phaseIds: ["open", "chosen", "after"],
    },
    { id: "again", kind: "runItBack", title: "Again?", phaseIds: ["after"] },
  ],

  awards: [],
  seedResponses: [],
  seedMoments: [
    moment(ANCHOR, -40, {
      kind: "voice",
      text: "No tickets, no reservation, no plan. Four questions and we'll find you an afternoon.",
    }),
  ],
};
