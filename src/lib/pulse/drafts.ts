import type { PulseKind } from "./model";

/**
 * **Proposed questions: a queue a person publishes from, never a feed.**
 *
 * Agents may add drafts here (with their mission number). Nothing is
 * published automatically: an administrator reads each one in
 * /admin/pulse and presses Publish. A draft marked `high-stakes` (politics,
 * health, money advice, anything that states a claim) also needs the
 * administrator to confirm they reviewed its wording and sources.
 *
 * Wording rules for drafts: neutral, about people's own experience or
 * preference, answers that cover the reasonable range, no claim in the
 * question itself. A source is linked where a figure or a policy is the
 * context, and every link was checked to answer at the time it was added.
 *
 * Each draft publishes as a Pulse whose id is derived from the draft's id, so
 * publishing twice is refused rather than duplicated.
 */

export type DraftTopic =
  | "consumer prices"
  | "housing"
  | "gaming"
  | "entertainment"
  | "technology"
  | "local communities"
  | "public policy"
  | "health";

export interface QuestionDraft {
  readonly id: string;
  readonly topic: DraftTopic;
  readonly kind: PulseKind;
  readonly question: string;
  readonly options: readonly string[];
  readonly description?: string;
  readonly sourceUrl?: string;
  readonly sources: readonly { readonly name: string; readonly url: string }[];
  readonly stakes: "everyday" | "high-stakes";
  /** Who proposed it and why now. */
  readonly proposedBy: string;
  readonly why: string;
}

export const QUESTION_DRAFTS: readonly QuestionDraft[] = [
  {
    id: "grocery-bill-vs-last-year",
    topic: "consumer prices",
    kind: "pulse",
    question:
      "Compared with a year ago, is your grocery bill higher, about the same, or lower?",
    options: ["Higher", "About the same", "Lower"],
    description:
      "Statistics Canada publishes the official food price index every month. This asks about your own bill.",
    sourceUrl:
      "https://www.statcan.gc.ca/en/subjects-start/prices_and_price_indexes/consumer_price_indexes",
    sources: [
      {
        name: "Statistics Canada — Consumer price indexes",
        url: "https://www.statcan.gc.ca/en/subjects-start/prices_and_price_indexes/consumer_price_indexes",
      },
    ],
    stakes: "everyday",
    proposedBy: "agent, mission 908",
    why: "Food prices are a monthly national story and everyone has a first-hand answer.",
  },
  {
    id: "renters-own-in-five-years",
    topic: "housing",
    kind: "pulse",
    question:
      "If you rent today, do you expect to own a home in the next five years?",
    options: ["Yes", "No", "Not sure", "I already own"],
    sourceUrl:
      "https://www.cmhc-schl.gc.ca/professionals/housing-markets-data-and-research",
    sources: [
      {
        name: "CMHC — Housing markets, data and research",
        url: "https://www.cmhc-schl.gc.ca/professionals/housing-markets-data-and-research",
      },
    ],
    stakes: "everyday",
    proposedBy: "agent, mission 908",
    why: "Housing affordability stays at the top of Canadian news; this asks about expectations, not policy.",
  },
  {
    id: "launch-day-full-price",
    topic: "gaming",
    kind: "pulse",
    question: "Do you still buy new games at full price on launch day?",
    options: [
      "Usually",
      "Sometimes",
      "Almost never — I wait for a sale",
      "I don't buy games",
    ],
    sources: [],
    stakes: "everyday",
    proposedBy: "agent, mission 908",
    why: "Big holiday releases land in November; a light question with a clear range of answers.",
  },
  {
    id: "where-you-watch-movies",
    topic: "entertainment",
    kind: "settle",
    question:
      "New movie you really want to see: theatre or wait for streaming?",
    options: ["Theatre", "Wait for streaming"],
    sources: [],
    stakes: "everyday",
    proposedBy: "agent, mission 908",
    why: "Holiday film season; an easy Settle This for the Labs page.",
  },
  {
    id: "ai-assistant-weekly",
    topic: "technology",
    kind: "pulse",
    question:
      "Do you use an AI assistant (like ChatGPT or Claude) at least once a week?",
    options: ["Yes, for work", "Yes, for personal things", "Both", "No"],
    sourceUrl:
      "https://www.statcan.gc.ca/en/subjects-start/digital_economy_and_society",
    sources: [
      {
        name: "Statistics Canada — Digital economy and society",
        url: "https://www.statcan.gc.ca/en/subjects-start/digital_economy_and_society",
      },
    ],
    stakes: "everyday",
    proposedBy: "agent, mission 908",
    why: "A fast-moving habit with official surveys behind it; asks about use, not opinion of the technology.",
  },
  {
    id: "know-your-neighbours",
    topic: "local communities",
    kind: "pulse",
    question: "How many of your neighbours do you know by name?",
    options: ["None", "One or two", "A few", "Most of them"],
    sources: [],
    stakes: "everyday",
    proposedBy: "agent, mission 908",
    why: "Evergreen, local, and interesting by province and city.",
  },
  {
    id: "clock-change",
    topic: "public policy",
    kind: "pulse",
    question: "Should your province keep changing the clocks twice a year?",
    options: [
      "Keep changing them",
      "Stay on standard time all year",
      "Stay on daylight time all year",
      "No opinion",
    ],
    sources: [],
    stakes: "high-stakes",
    proposedBy: "agent, mission 908",
    why: "Comes back every November after the clocks change; policy, so it needs a person's review and, ideally, a source naming each province's current law.",
  },
  {
    id: "flu-shot-this-season",
    topic: "health",
    kind: "pulse",
    question: "Have you had a flu shot this season?",
    options: ["Yes", "Not yet, but I plan to", "No, not this year"],
    sourceUrl:
      "https://www.canada.ca/en/public-health/services/diseases/flu-influenza.html",
    sources: [
      {
        name: "Public Health Agency of Canada — Flu (influenza)",
        url: "https://www.canada.ca/en/public-health/services/diseases/flu-influenza.html",
      },
    ],
    stakes: "high-stakes",
    proposedBy: "agent, mission 908",
    why: "Flu season; health, so it is held for review. Asks what people did, never whether they should.",
  },
];

export const findDraft = (id: unknown): QuestionDraft | null =>
  QUESTION_DRAFTS.find((d) => d.id === id) ?? null;
