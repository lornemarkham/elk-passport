import type { PulseKind } from "./model";

/**
 * **Quick Ideas: the experiences and templates on the People's Pulse engine.**
 *
 * An experience is a kind (model.ts). A template is only a head start on the
 * one create form: a kind, a placeholder, maybe preset answers. Nothing here
 * adds behaviour — every template is a People's Pulse a person could have made
 * by hand — so adding one is a few lines, and none is a separate application.
 */

export interface Experience {
  readonly kind: PulseKind;
  readonly name: string;
  /** One line under the name. */
  readonly line: string;
  /** What the create page asks first. */
  readonly ask: string;
  readonly placeholder: string;
  readonly example: string;
}

export const EXPERIENCES: readonly Experience[] = [
  {
    kind: "pulse",
    name: "People's Pulse",
    line: "Ask everyone a question and see what people really think.",
    ask: "Your question",
    placeholder: "Should Vernon build a second sheet of ice?",
    example: "Should school start later in the morning?",
  },
  {
    kind: "decide",
    name: "Should I Do It?",
    line: "Yes, no or not yet — and why. Ask the people who know you.",
    ask: "What are you deciding?",
    placeholder: "Should I quit my job?",
    example: "Should I quit my job?",
  },
  {
    kind: "settle",
    name: "Settle This",
    line: "Two sides, one argument. Let everyone vote it over.",
    ask: "What's the argument?",
    placeholder: "Does pineapple belong on pizza?",
    example: "Does pineapple belong on pizza?",
  },
  {
    kind: "normal",
    name: "Is This Normal?",
    line: "Compare what you spend, earn or put up with — anonymously.",
    ask: "What do you want to compare?",
    placeholder: "What does your household spend on groceries a month?",
    example: "Is my grocery bill normal?",
  },
  {
    kind: "rank",
    name: "Rank These",
    line: "Put a few things in order and see the group's ranking.",
    ask: "What are people ranking?",
    placeholder: "Rank these for movie night",
    example: "Rank tonight's movie picks",
  },
];

/**
 * Pulse Check is a kind of Pulse but not one of the create form's ways to
 * ask: it starts from a claim at `/check/new`, so it is kept off this list.
 */
export const CHECK_EXPERIENCE: Experience = {
  kind: "check",
  name: "Pulse Check",
  line: "Seen a claim? Check what the evidence says, then share it back.",
  ask: "What does it claim?",
  placeholder: "Kelowna General Hospital is operating at 147% capacity.",
  example: "Is the hospital really at 147% capacity?",
};

export const experience = (kind: PulseKind): Experience =>
  EXPERIENCES.find((e) => e.kind === kind) ?? CHECK_EXPERIENCE;

/** Is This Normal? topics: ordered ranges (never a raw number) and a category. */
export interface NormalTopic {
  readonly id: string;
  readonly name: string;
  readonly question: string;
  readonly unit: string | null;
  readonly ranges: readonly string[];
  readonly group: {
    readonly label: string;
    readonly options: readonly string[];
  } | null;
}

const HOUSEHOLD = { label: "Household size", options: ["1", "2", "3–4", "5+"] };

export const NORMAL_TOPICS: readonly NormalTopic[] = [
  {
    id: "groceries",
    name: "Groceries",
    question: "What does your household spend on groceries a month?",
    unit: "per month",
    ranges: [
      "Under $400",
      "$400–$699",
      "$700–$999",
      "$1,000–$1,399",
      "$1,400+",
    ],
    group: HOUSEHOLD,
  },
  {
    id: "commute",
    name: "Commute",
    question: "How long is your commute, one way?",
    unit: "one way",
    ranges: [
      "Under 15 min",
      "15–29 min",
      "30–44 min",
      "45–59 min",
      "An hour or more",
    ],
    group: {
      label: "How you get there",
      options: ["Drive", "Transit", "Walk or bike", "A mix"],
    },
  },
  {
    id: "vacation",
    name: "Vacation days",
    question: "How many paid vacation days do you get a year?",
    unit: "per year",
    ranges: ["None", "1–9", "10–14", "15–19", "20–24", "25 or more"],
    group: {
      label: "Years with your employer",
      options: ["Under 2", "2–5", "6–10", "Over 10"],
    },
  },
  {
    id: "phone",
    name: "Phone bill",
    question: "What do you pay for your phone plan each month?",
    unit: "per month, before tax",
    ranges: ["Under $30", "$30–$49", "$50–$69", "$70–$99", "$100+"],
    group: {
      label: "Data per month",
      options: ["Under 10 GB", "10–49 GB", "50 GB or more"],
    },
  },
  {
    id: "restaurants",
    name: "Eating out",
    question: "How much do you spend eating out in a month?",
    unit: "per month",
    ranges: ["Under $50", "$50–$149", "$150–$299", "$300–$499", "$500+"],
    group: HOUSEHOLD,
  },
  {
    id: "internet",
    name: "Home internet",
    question: "What do you pay for home internet each month?",
    unit: "per month, before tax",
    ranges: ["Under $50", "$50–$74", "$75–$99", "$100+"],
    group: {
      label: "Speed",
      options: ["Under 100 Mbps", "100–499 Mbps", "500 Mbps+", "Not sure"],
    },
  },
  {
    id: "pay",
    name: "Yearly pay",
    question: "What's your yearly pay before tax?",
    unit: "per year, before tax",
    ranges: [
      "Under $40k",
      "$40k–$59k",
      "$60k–$79k",
      "$80k–$99k",
      "$100k–$129k",
      "$130k+",
    ],
    group: {
      label: "Field",
      options: [
        "Trades",
        "Healthcare",
        "Tech",
        "Education",
        "Retail & service",
        "Office & admin",
      ],
    },
  },
];

export interface Template {
  readonly id: string;
  readonly name: string;
  readonly line: string;
  readonly kind: PulseKind;
  readonly placeholder?: string;
  readonly options?: readonly string[];
  readonly reasons?: boolean;
  readonly unlisted?: boolean;
  readonly scope?: "canada" | "city";
  readonly ends?: "1w";
  /** Opens "Add details" with the published-claim section in view. */
  readonly claim?: boolean;
  /** Is This Normal? topics this template offers (first is picked). */
  readonly topics?: readonly string[];
  readonly prefix?: string;
}

/**
 * Phase 5's list, built where an existing mode already does the work. Kept
 * out on purpose: "GTA" by name (a trademark; Gaming Pulse covers it).
 */
export const TEMPLATES: readonly Template[] = [
  {
    id: "which-to-buy",
    name: "Which One Should I Buy?",
    line: "Two to four choices; friends pick one and say why.",
    kind: "settle",
    placeholder: "Which laptop should I buy?",
    reasons: true,
    unlisted: true,
  },
  {
    id: "overpaying",
    name: "Am I Overpaying?",
    line: "Phone, internet, groceries: see where your bill sits.",
    kind: "normal",
    topics: ["phone", "internet", "groceries", "restaurants"],
  },
  {
    id: "underpaid",
    name: "Am I Underpaid?",
    line: "Pay ranges by field. Small groups stay hidden.",
    kind: "normal",
    topics: ["pay"],
  },
  {
    id: "buy-house",
    name: "Would You Buy This House?",
    line: "Describe it and the price; people say yes, lower, or no.",
    kind: "pulse",
    placeholder: "Would you buy a 3-bed in Vernon for $749,000?",
    options: ["Yes, at that price", "Only for less", "No"],
    reasons: true,
  },
  {
    id: "what-would-you-do",
    name: "What Would You Do?",
    line: "A situation, a few choices, and everyone's reasons.",
    kind: "pulse",
    placeholder: "A friend forgets your birthday. What do you do?",
    reasons: true,
  },
  {
    id: "change-my-mind",
    name: "Change My Mind",
    line: "State your take. People agree or disagree — and say why.",
    kind: "pulse",
    prefix: "Change my mind: ",
    placeholder: "Change my mind: tipping should be included in the price",
    options: ["Agree", "Disagree"],
    reasons: true,
  },
  {
    id: "prediction",
    name: "Make a Prediction",
    line: "Call it before it happens. Voting closes in a week.",
    kind: "pulse",
    placeholder: "Who wins the Grey Cup?",
    ends: "1w",
  },
  {
    id: "ask-canada",
    name: "Ask Canada",
    line: "One question for the whole country, province by province.",
    kind: "pulse",
    placeholder: "Should Canada keep daylight saving time?",
    scope: "canada",
  },
  {
    id: "your-town",
    name: "What Would Your Town Do?",
    line: "A question about one place, for the people who live there.",
    kind: "pulse",
    placeholder: "Should Vernon build a second sheet of ice?",
    scope: "city",
  },
  {
    id: "challenge-stat",
    name: "Challenge This Statistic",
    line: "Put a published figure next to what people actually say.",
    kind: "pulse",
    placeholder: "Do most Canadians really work from home two days a week?",
    claim: true,
  },
  {
    id: "gaming",
    name: "Gaming Pulse",
    line: "Best game, worst launch, most anticipated — ask gamers.",
    kind: "pulse",
    placeholder: "Most anticipated game of next year?",
  },
];

export const findTemplate = (id: unknown): Template | null =>
  TEMPLATES.find((t) => t.id === id) ?? null;

export const findTopic = (id: unknown): NormalTopic | null =>
  NORMAL_TOPICS.find((t) => t.id === id) ?? null;

/** Readable name for a kind or template id, for the usage table. */
export function usageName(id: string): string {
  return (
    EXPERIENCES.find((e) => e.kind === id)?.name ??
    (id === "check" ? CHECK_EXPERIENCE.name : null) ??
    TEMPLATES.find((t) => t.id === id)?.name ??
    id
  );
}

/** Everything the create form needs to start from a kind or a template. */
export interface Preset {
  readonly kind: PulseKind;
  readonly template: string | null;
  readonly title: string;
  readonly line: string;
  readonly ask: string;
  readonly placeholder: string;
  readonly prefix: string;
  readonly options: readonly string[] | null;
  readonly reasons: boolean;
  readonly unlisted: boolean;
  readonly scope: "canada" | "city";
  readonly ends: "never" | "1w";
  readonly claim: boolean;
  /** Is This Normal?: the topics to choose from; empty means "make your own". */
  readonly topics: readonly NormalTopic[];
}

/** `?t=<template>`, `?kind=<kind>`, `?private=1`, from the create page's address. */
export function presetFrom(params: {
  t?: unknown;
  kind?: unknown;
  private?: unknown;
}): Preset {
  const t = findTemplate(params.t);
  const kind: PulseKind =
    t?.kind ??
    (EXPERIENCES.some((e) => e.kind === params.kind)
      ? (params.kind as PulseKind)
      : "pulse");
  const e = experience(kind);
  const topics =
    kind === "normal"
      ? (t?.topics ?? NORMAL_TOPICS.map((x) => x.id)).map((id) =>
          findTopic(id)!,
        )
      : [];
  return {
    kind,
    template: t?.id ?? null,
    title: t?.name ?? (kind === "pulse" ? "Create a Pulse" : e.name),
    line: t?.line ?? e.line,
    ask: e.ask,
    placeholder: t?.placeholder ?? e.placeholder,
    prefix: t?.prefix ?? "",
    options: t?.options ?? null,
    reasons: kind === "decide" || t?.reasons === true,
    unlisted: t?.unlisted ?? (kind === "decide" || params.private === "1"),
    scope: t?.scope ?? "canada",
    ends: t?.ends ?? "never",
    claim: t?.claim === true,
    topics,
  };
}
