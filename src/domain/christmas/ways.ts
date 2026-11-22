import {
  DEFAULT_KM,
  type Answer,
  type Ask,
  type Find,
  type Party,
} from "./discover";
import { IDEAS, type Idea, type IdeaFor, type IdeaTag } from "./ideas";
import type { ThemeId } from "./themes";
import { addDays, type Confidence } from "./when";

/**
 * **Six ways to have a Christmas** — the front door of Go Have a Christmas
 * (owner brief "P0 — the experience-first rebuild", 2026-11-17).
 *
 * The page used to be a directory: six rows of event cards, one after
 * another. It now asks one thing — _what kind of Christmas do you want?_ —
 * and each answer is a short, progressive page: a question or two, answered
 * by tapping, and a handful of things to do. Nothing is asked before
 * something is shown (doctrine §4), and every answer is in the address, so a
 * page can be shared as it is.
 *
 * A way is a **composition of sources that already exist**, never a store of
 * its own:
 *
 * - `themes` — Atlas's Christmas finds, read by `themes.ts` and narrowed by
 *   `answer` (Atlas is the only source of real events and places);
 * - `IDEAS` — Passport's hand-written ideas, said as ideas (`ideas.ts`);
 * - `plans` — sentences handed to the Christmas planner, which makes each
 *   part a real place or says it can't (`itinerary.ts`).
 *
 * The future capabilities the brief names (Canadian streaming, showtimes,
 * at-home adventures, combined days) are new sources a way can list, not new
 * ways.
 */

export type WayId =
  "lights" | "date" | "family" | "friends" | "cozy" | "events";

export interface Way {
  readonly id: WayId;
  readonly label: string;
  /** One line on the card. */
  readonly line: string;
  /** The few things the way covers, said on its page. */
  readonly includes: readonly string[];
  readonly emoji: string;
  /** The card's designed artwork: two colours and the accent of its lights. */
  readonly art: {
    readonly from: string;
    readonly to: string;
    readonly glow: string;
  };
  /** Atlas's themes this way's real finds come from (none: ideas only). */
  readonly themes: readonly ThemeId[];
  readonly party?: Party;
  /** The questions its page offers, in order. All optional. */
  readonly questions: readonly QuestionId[];
}

export const WAYS: readonly Way[] = [
  {
    id: "lights",
    label: "Christmas Lights",
    line: "The lights map, and a tour built for you.",
    includes: [
      "Christmas Lights Map",
      "Build My Lights Tour",
      "Nearby displays",
      "Saved tours",
    ],
    emoji: "✨",
    art: { from: "#0b2a4a", to: "#061527", glow: "#ffd98a" },
    themes: ["lights"],
    questions: [],
  },
  {
    id: "date",
    label: "Christmas Date",
    line: "Dinner and the lights, a movie, a walk.",
    includes: [
      "Romantic outings",
      "Dinner and lights",
      "Movies",
      "Festive walks",
      "Date-night ideas",
    ],
    emoji: "🌙",
    art: { from: "#6b1420", to: "#2a060b", glow: "#ffb3a8" },
    themes: ["lights", "shows", "food", "markets"],
    party: "couple",
    questions: ["when", "stay"],
  },
  {
    id: "family",
    label: "Family Fun",
    line: "Santa, skating, markets and sledding.",
    includes: [
      "Santa",
      "Markets",
      "Skating",
      "Sledding",
      "Family activities",
      "Christmas traditions",
    ],
    emoji: "🎅",
    art: { from: "#b3242f", to: "#5c0f17", glow: "#fff1c9" },
    themes: ["santa", "markets", "winter", "lights", "festivals"],
    party: "family",
    questions: ["age", "when", "far"],
  },
  {
    id: "friends",
    label: "Friends & Fun",
    line: "Markets, skating, games and a festive drink.",
    includes: [
      "Group activities",
      "Festive outings",
      "Games",
      "Markets",
      "Shared adventures",
    ],
    emoji: "🥂",
    art: { from: "#3d2a6b", to: "#160d2e", glow: "#d9c8ff" },
    themes: ["markets", "festivals", "shows", "winter", "food"],
    party: "friends",
    questions: ["when", "stay"],
  },
  {
    id: "cozy",
    label: "Cozy Christmas",
    line: "Movies, baking, games and carols at home.",
    includes: [
      "Christmas movies",
      "Baking",
      "Food",
      "Board games",
      "Christmas music",
      "At-home activities",
    ],
    emoji: "☕",
    art: { from: "#7a4a22", to: "#2e1a0b", glow: "#ffe2b0" },
    themes: [],
    questions: ["mood"],
  },
  {
    id: "events",
    label: "Events & Markets",
    line: "Markets, shows and festivals near you.",
    includes: [
      "Real Christmas events",
      "Markets",
      "Performances",
      "Festivals",
      "Activities happening nearby",
    ],
    emoji: "🎪",
    art: { from: "#0f3b2b", to: "#04170f", glow: "#ffd98a" },
    themes: ["markets", "festivals", "shows", "santa", "lights", "food"],
    questions: ["when", "kind"],
  },
];

export const isWayId = (s: string | undefined): s is WayId =>
  WAYS.some((w) => w.id === s);
export const wayById = (id: WayId): Way => WAYS.find((w) => w.id === id)!;

/** Where a way's card goes. The lights are the map itself, not a page about it. */
export function wayHref(
  id: WayId,
  at?: string,
  lightsTown = false,
  km?: number,
): string {
  const q = new URLSearchParams();
  if (id !== "lights" || (at && lightsTown)) if (at) q.set("at", at);
  if (km && km !== DEFAULT_KM) q.set("km", String(km));
  const query = q.size ? `?${q.toString()}` : "";
  return id === "lights"
    ? `/christmas/lights${query}`
    : `/christmas/for/${id}${query}`;
}

// ------------------------------------------------------------- questions

export type QuestionId = "when" | "stay" | "age" | "far" | "kind" | "mood";
export type When = "tonight" | "weekend" | "soon" | "any";
export type Stay = "out" | "in";
export type AgeBand = "under5" | "5to9" | "10plus";
export type Far = "near" | "drive";

/** What somebody tapped on a way's page. Every answer is optional. */
export interface Choice {
  readonly when?: When;
  readonly stay?: Stay;
  readonly age?: AgeBand;
  readonly far?: Far;
  readonly kind?: ThemeId;
  readonly mood?: IdeaTag;
}

export interface Question {
  readonly id: QuestionId;
  readonly label: string;
  readonly options: readonly {
    readonly value: string;
    readonly label: string;
  }[];
}

const WHEN_OPTIONS: readonly { value: When; label: string }[] = [
  { value: "tonight", label: "Tonight" },
  { value: "weekend", label: "This weekend" },
  { value: "soon", label: "Next two weeks" },
  { value: "any", label: "Any time" },
];

export function questionsFor(way: Way): readonly Question[] {
  return way.questions.map((id): Question => {
    switch (id) {
      case "when":
        return {
          id,
          label: "When?",
          options:
            way.id === "events"
              ? WHEN_OPTIONS.filter((o) => o.value !== "tonight")
              : WHEN_OPTIONS.filter((o) => o.value !== "soon"),
        };
      case "stay":
        return {
          id,
          label: "Going out or staying in?",
          options: [
            { value: "out", label: "Going out" },
            { value: "in", label: "Staying in" },
          ],
        };
      case "age":
        return {
          id,
          label: "How old is the youngest?",
          options: [
            { value: "under5", label: "Under 5" },
            { value: "5to9", label: "5 to 9" },
            { value: "10plus", label: "10 or older" },
          ],
        };
      case "far":
        return {
          id,
          label: "How far?",
          options: [
            { value: "near", label: "Close to home" },
            { value: "drive", label: "Happy to drive" },
          ],
        };
      case "kind":
        return {
          id,
          label: "What kind?",
          options: [
            { value: "markets", label: "Markets" },
            { value: "festivals", label: "Festivals" },
            { value: "shows", label: "Shows" },
            { value: "santa", label: "Santa" },
          ],
        };
      case "mood":
        return {
          id,
          label: "What sounds good?",
          options: (
            ["movies", "baking", "food", "games", "music"] as const
          ).map((value) => ({
            value,
            label: {
              movies: "Movies",
              baking: "Baking",
              food: "Food",
              games: "Games",
              music: "Music",
            }[value],
          })),
        };
    }
  });
}

type Params = Readonly<Record<string, string | string[] | undefined>>;
const one = (p: Params, k: string) => {
  const v = p[k];
  return typeof v === "string" ? v : undefined;
};

/** The address is the state: only answers the way's questions allow are read. */
export function readChoice(way: Way, params: Params): Choice {
  const allowed = new Map(
    questionsFor(way).map((q) => [q.id, q.options.map((o) => o.value)]),
  );
  const take = <T extends string>(id: QuestionId): T | undefined => {
    const v = one(params, id);
    return v && allowed.get(id)?.includes(v) ? (v as T) : undefined;
  };
  return {
    ...(take<When>("when") ? { when: take<When>("when") } : {}),
    ...(take<Stay>("stay") ? { stay: take<Stay>("stay") } : {}),
    ...(take<AgeBand>("age") ? { age: take<AgeBand>("age") } : {}),
    ...(take<Far>("far") ? { far: take<Far>("far") } : {}),
    ...(take<ThemeId>("kind") ? { kind: take<ThemeId>("kind") } : {}),
    ...(take<IdeaTag>("mood") ? { mood: take<IdeaTag>("mood") } : {}),
  };
}

/** The address for a choice, with one answer changed (tapping it again clears it). */
export function choiceHref(
  way: Way,
  choice: Choice,
  at: string | undefined,
  change?: { readonly id: QuestionId; readonly value: string },
): string {
  const next: Record<string, string | undefined> = { ...choice };
  if (change)
    next[change.id] =
      next[change.id] === change.value ? undefined : change.value;
  const q = new URLSearchParams();
  if (at) q.set("at", at);
  for (const id of way.questions) {
    const v = next[id];
    if (v) q.set(id, v);
  }
  const s = q.toString();
  return `/christmas/for/${way.id}${s ? `?${s}` : ""}`;
}

// ---------------------------------------------------------------- dates

const dow = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay();

/** The days a "when" means, from today (Vancouver's date). */
export function datesFor(
  when: When | undefined,
  today: string,
): { readonly from?: string; readonly to?: string } {
  switch (when) {
    case "tonight":
      return { from: today, to: today };
    case "weekend": {
      const d = dow(today);
      // Saturday or Sunday: the rest of this weekend; otherwise the next one.
      if (d === 6) return { from: today, to: addDays(today, 1) };
      if (d === 0) return { from: today, to: today };
      const sat = addDays(today, 6 - d);
      return { from: sat, to: addDays(sat, 1) };
    }
    case "soon":
      return { from: today, to: addDays(today, 13) };
    default:
      return {};
  }
}

/** The words a "when" adds to a planner sentence, which `dayIn` reads back. */
const WHEN_WORDS: Readonly<Record<When, string>> = {
  tonight: " tonight",
  weekend: " this weekend",
  soon: "",
  any: "",
};

const AGE_OF: Readonly<Record<AgeBand, number>> = {
  under5: 3,
  "5to9": 6,
  "10plus": 10,
};

/** The Christmas Discover ask a way's choice amounts to. */
export function askFor(
  way: Way,
  choice: Choice,
  at: string | undefined,
  today: string,
): Ask {
  return {
    ...(at ? { at } : {}),
    // The distance choices are 2–50 km (owner brief 2026-11-22).
    km: choice.far === "near" ? 20 : choice.far === "drive" ? 50 : DEFAULT_KM,
    ...datesFor(choice.when, today),
    ...(way.party ? { party: way.party } : {}),
    ages: choice.age ? [AGE_OF[choice.age]] : [],
    themes: choice.kind ? [choice.kind] : way.themes,
    budget: "any",
  };
}

/** Whether this choice is answered with real Atlas finds at all. */
export function wantsFinds(way: Way, choice: Choice): boolean {
  if (way.themes.length === 0) return false;
  return choice.stay !== "in";
}

// ---------------------------------------------------------------- plans

export interface PlanIdea {
  readonly id: string;
  readonly title: string;
  readonly line: string;
  readonly emoji: string;
  /** Handed to `/christmas/itinerary?say=` as it is. */
  readonly say: string;
}

/**
 * The outings a way can build straight away, as sentences the planner
 * reads. Its answer is a real place per part, or an honest gap.
 */
export function plansFor(way: Way, choice: Choice): readonly PlanIdea[] {
  if (choice.stay === "in") return [];
  const when = choice.when ? WHEN_WORDS[choice.when] : "";
  switch (way.id) {
    case "date":
      return [
        {
          id: "dinner-lights",
          title: "Dinner and the lights",
          line: "A table somewhere warm, then the best displays nearby.",
          emoji: "🍽️",
          say: `A romantic Christmas evening${when} — dinner and the lights`,
        },
        {
          id: "movie-drink",
          title: "A movie and a festive drink",
          line: "The cinema, then somewhere for a nightcap.",
          emoji: "🎬",
          say: `A Christmas date${when} — a movie and drinks`,
        },
        {
          id: "show-dinner",
          title: "A Christmas show, then dinner",
          line: "Carols, a Nutcracker or a panto — then eat.",
          emoji: "🎭",
          say: `A Christmas date${when} — a Christmas show, then dinner`,
        },
      ];
    case "family": {
      const age = choice.age
        ? ` with kids aged ${AGE_OF[choice.age]}`
        : " with the kids";
      return [
        {
          id: "family-day",
          title: "Santa, skating and the lights",
          line: "The whole family day, start to finish.",
          emoji: "🎅",
          say: `A family Christmas adventure${age}${when} — Santa, skating and the lights`,
        },
        {
          id: "market-cocoa",
          title: "A market and a hot chocolate",
          line: "Stalls, treats and something warm to hold.",
          emoji: "🎪",
          say: `Christmas markets and a hot chocolate${age}${when}`,
        },
      ];
    }
    case "friends":
      return [
        {
          id: "market-lunch-drinks",
          title: "Market, lunch and a festive drink",
          line: "Wander, eat, then raise a glass.",
          emoji: "🥂",
          say: `With friends${when} — a Christmas market, lunch and drinks`,
        },
        {
          id: "skate-drinks",
          title: "Skating, then drinks",
          line: "A few laps, then somewhere warm.",
          emoji: "⛸️",
          say: `With friends${when} — skating, then drinks`,
        },
        {
          id: "lights-pub",
          title: "The lights, then the pub",
          line: "A lights tour after dark and a pint to finish.",
          emoji: "✨",
          say: `With friends${when} — the Christmas lights after dark, then a pub`,
        },
      ];
    default:
      return [];
  }
}

/** Passport's ideas for a way and a choice — said as ideas on every card. */
export function ideasFor(way: Way, choice: Choice): readonly Idea[] {
  if (way.id === "lights" || way.id === "events") return [];
  const mine = IDEAS.filter((i) => i.for.includes(way.id as IdeaFor));
  const byStay = choice.stay
    ? mine.filter((i) => i.stay === choice.stay)
    : mine;
  const byMood = choice.mood
    ? byStay.filter((i) => i.tags.includes(choice.mood!))
    : byStay;
  // Cozy is at home; the others lead with outings unless staying in was said.
  const sorted =
    way.id === "cozy"
      ? [...byMood].sort(
          (a, b) => Number(a.stay === "out") - Number(b.stay === "out"),
        )
      : choice.stay === undefined
        ? [...byMood].sort(
            (a, b) => Number(a.stay === "in") - Number(b.stay === "in"),
          )
        : byMood;
  return sorted.slice(0, way.id === "cozy" || choice.stay === "in" ? 8 : 4);
}

// ---------------------------------------------------------------- finds

const SURE: Readonly<Record<Confidence, number>> = {
  dated: 0,
  check: 1,
  unconfirmed: 2,
  past: 3,
};
const hasPicture = (f: Find) =>
  Boolean(f.experience.heroMedia || f.experience.contextualMedia);

/** Longer than this, a "dated" run is more likely a listing's whole season (or an Atlas misreading) than a day to plan around. */
export const LONG_RUN_DAYS = 60;

/**
 * Whether a find's dates are a long run rather than days to go. Atlas holds
 * one-night events as year-long ranges (a DJ night read as 2025-12-25 →
 * 2026-12-25, M865); such a find is still shown where everything is listed,
 * but is not put forward as one of the few strongest.
 */
export const longRun = (f: Find): boolean =>
  Boolean(
    f.when.from &&
    f.when.to &&
    (Date.parse(f.when.to) - Date.parse(f.when.from)) / 86_400_000 >
      LONG_RUN_DAYS,
  );

/** Recommendation order: surest, a real stretch of days, pictured, nearest. */
export function byStrength(a: Find, b: Find): number {
  return (
    SURE[a.when.confidence] - SURE[b.when.confidence] ||
    Number(longRun(a)) - Number(longRun(b)) ||
    Number(hasPicture(b)) - Number(hasPicture(a)) ||
    (a.km ?? Infinity) - (b.km ?? Infinity) ||
    a.experience.title.localeCompare(b.experience.title)
  );
}

/**
 * **A few strong finds, not a directory.** Only what Atlas places within the
 * asked distance or in the town's own area — never an unplaced find claimed
 * as near — this season's, surest first, then pictured, then nearest. Winter
 * fun that isn't Christmas (a rink) needs days or a window behind it, as on
 * the old front page (`around.ts`).
 */
export function strongest(answered: Answer, n: number): readonly Find[] {
  const shelf = (id: string) =>
    answered.shelves.find((s) => s.id === id)?.finds ?? [];
  const here = answered.town
    ? [...shelf("near"), ...shelf("area")]
    : answered.shelves
        .filter((s) => s.id.startsWith("area-"))
        .flatMap((s) => s.finds);
  return here
    .filter(
      (f) =>
        f.when.confidence !== "past" &&
        (f.reading.christmas ||
          f.when.confidence === "dated" ||
          f.when.confidence === "check"),
    )
    .sort(byStrength)
    .slice(0, n);
}

/** How many a way's answer holds beyond the few shown, for "see all". */
export function countHere(answered: Answer): number {
  return answered.shelves
    .filter(
      (s) => s.id === "near" || s.id === "area" || s.id.startsWith("area-"),
    )
    .reduce((n, s) => n + s.finds.length, 0);
}

// ------------------------------------------------------------- surprise

export type Surprise =
  | { readonly kind: "find"; readonly find: Find }
  | { readonly kind: "idea"; readonly idea: Idea };

/**
 * **Surprise me** — one thing, from what is real near here (a dated or
 * windowed Christmas find) and Passport's ideas, picked by `seed`. The card
 * says which of the two it is.
 */
export function surprise(finds: readonly Find[], seed: number): Surprise {
  const pool: Surprise[] = [
    ...finds
      .filter(
        (f) => f.when.confidence === "dated" || f.when.confidence === "check",
      )
      .map((find) => ({ kind: "find" as const, find })),
    ...IDEAS.map((idea) => ({ kind: "idea" as const, idea })),
  ];
  const i = ((Math.floor(seed) % pool.length) + pool.length) % pool.length;
  return pool[i]!;
}

/** A fresh draw for Surprise me (the page then keeps it in its address). */
export const drawSeed = (): number => Math.floor(Math.random() * 997);
