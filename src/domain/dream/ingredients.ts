import type { Experience } from "@/domain/experience/types";
import {
  ACTIVITIES,
  activityEvidence,
  activityIn,
  type Activity,
} from "@/domain/discovery/activities";
import { readChristmas } from "@/domain/christmas/themes";

/**
 * **The things a person names in a dream, and the Atlas words that prove a
 * place has one.**
 *
 * > "Find skating, Christmas lights and hot chocolate within 10 km."
 *
 * Three ingredients, each answered separately — the rinks, the lights, the
 * cafés — before the Day Builder makes one afternoon of them. That is the
 * difference between this and `/go`: a person who is still dreaming wants
 * to see the choices for each thing, not only the one the builder picked.
 *
 * ## Most of this is not new
 *
 * An ingredient is, wherever possible, one of ADR 007's activities, and a
 * place belongs to it only by `activityEvidence` — Atlas's own words, quoted
 * on the card. The few kept here are things the taxonomy does not say, or
 * says in a way that would be a substitution:
 *
 * - **Christmas lights** are read by Christmas's own reader (`readChristmas`),
 *   so a lights display means the same thing here as on `/christmas`.
 * - **Somewhere to stay** is asked for, never offered (doctrine §12, "A bed
 *   is asked for"): it appears only when the sentence names it.
 * - **Hot springs** are only a place that says *hot spring*. The taxonomy
 *   files "hot springs" under Spa, which is how a resort spa would be handed
 *   to somebody who asked for a free soak in the woods. Here it is not.
 * - **A campfire** is a place that states campfires or fire pits.
 * - **Something warm to drink** is a café, said as a café: Atlas lists no
 *   menus, so "hot chocolate" is a good bet, never a promise.
 */
export interface Ingredient {
  readonly id: string;
  /** What the person would call it, for the scene's heading. */
  readonly label: string;
  /** The words that name it in a sentence. */
  readonly words: RegExp;
  /**
   * The Atlas words that put a place in it — quoted on the card. Empty means
   * the place is not one of these, whatever it is called.
   */
  readonly evidence: (experience: Experience) => readonly string[];
  /** Where in a day it tends to sit. */
  readonly role: Role;
  /** Said when nothing near has it, in place of a guess. */
  readonly none: string;
  /**
   * **Which of them is more what was meant** — "the woods" is a trail or a
   * provincial park before it is a downtown lawn with a path. Ranking only:
   * it never removes a place that has the evidence.
   */
  readonly prefer?: RegExp;
}

export type Role =
  "do" | "outside" | "meal" | "drink" | "lights" | "night" | "stay";

const textOf = (e: Experience): string =>
  [
    e.title,
    e.subtype ?? "",
    ...(e.knowledge?.features ?? []),
    ...(e.knowledge?.affordances ?? []).map((a) => a.name),
  ].join(" · ");

/** Words Atlas holds for this place that match, as Atlas holds them. */
function stated(e: Experience, pattern: RegExp): string[] {
  const out = new Set<string>();
  const fields = [
    e.subtype ?? "",
    ...(e.knowledge?.features ?? []),
    ...(e.knowledge?.affordances ?? []).map((a) => a.name),
    e.title,
  ];
  for (const field of fields) {
    if (field && pattern.test(field)) out.add(field.trim());
  }
  return [...out].slice(0, 3);
}

const byActivity =
  (key: string) =>
  (e: Experience): readonly string[] => {
    const activity = ACTIVITIES.find((a) => a.key === key);
    return activity ? activityEvidence(e, activity) : [];
  };

const ACCOMMODATION =
  /^(hotel|resort|motel|inn|lodge|bed and breakfast|b&b|accommodation|guest ?house|chalet|cabins?|boutique hotel|mountain resort|golf resort|spa resort)$/i;

/** Not a dinner somebody would go out of their way for. */
export const NOT_A_DINNER =
  /\b(fast[ _]?food|food[ _]?truck|cafe|café|coffee|bakery|donut|doughnut|bubble tea|ice cream|takeout|take-out|convenience|grocery|deli|food court|cafeteria)\b/i;

/** Not a place somebody calls *incredible* when they say money is no object. */
const EVERYDAY_FOOD =
  /\b(pizza|pizzeria|burgers?|subs?|sandwich\w*|chicken|wings|noodle house|diner|family restaurant|pub|sports bar|earls|cactus club|boston pizza|white spot|denny'?s|montana'?s|browns socialhouse|joey|a&w|tim hortons|mcdonald'?s)\b/i;

/**
 * **A restaurant's own words that sound like an occasion** — quoted on the
 * card as the reason it leads. Atlas rates no restaurant and lists no menu,
 * so this is the only honest evidence there is that a dinner is *incredible*:
 * what the place says about itself.
 */
export const OCCASION_WORDS =
  /\b(fine dining|tasting menu|chef'?s?|seasonal menu|farm[- ]to[- ]table|wine pairings?|sommelier|elegant|upscale|intimate|award[- ]winning|lakeside|lake views?|panoramic|views? of the lake|candle\w*|romantic|prix fixe|multi-course|locally sourced)\b/i;

/** The occasion words a place uses about itself, as it uses them. */
export function occasionWords(e: Experience): string[] {
  const text = `${e.shortDescription ?? ""} ${e.description ?? ""}`;
  const found = new Set<string>();
  for (const m of text.matchAll(new RegExp(OCCASION_WORDS, "gi")))
    found.add(m[0].toLowerCase());
  return [...found].slice(0, 2);
}

export const INGREDIENTS: readonly Ingredient[] = [
  {
    id: "lights",
    label: "Christmas lights",
    words:
      /\b(christmas lights?|holiday lights?|light displays?|light shows?|lights? tour|festival of lights|the lights)\b/i,
    evidence: (e) => {
      const reading = readChristmas(e);
      if (!reading?.themes.includes("lights")) return [];
      const lit = reading.evidence.find((x) =>
        /light|lumin|glow|illuminat|twinkl/i.test(x.word),
      );
      return [lit?.word ?? reading.evidence[0]?.word ?? "lights"];
    },
    role: "lights",
    none: "Atlas has no light display listed near here yet. Many go up in late November; Passport won't guess a street.",
  },
  {
    id: "hot-springs",
    label: "Hot springs",
    words: /\bhot ?springs?\b|\bnatural springs?\b|\bsoak\b/i,
    evidence: (e) => stated(e, /\bhot ?springs?\b/i),
    role: "outside",
    none: "Atlas doesn't hold a single hot spring in this part of BC. Passport won't swap in a spa and call it one.",
  },
  {
    id: "stay",
    label: "Somewhere beautiful to stay",
    words:
      /\b(hotels?|somewhere to stay|place to stay|stay the night|overnight|resorts?|lodges?|bed and breakfast|b&b|inn)\b/i,
    evidence: (e) =>
      e.subtype && ACCOMMODATION.test(e.subtype.trim()) ? [e.subtype] : [],
    role: "stay",
    none: "Atlas has no hotel listed near here.",
  },
  {
    id: "campfire",
    label: "A campfire",
    words: /\b(campfires?|camp ?fires?|fire ?pits?|bonfires?|fire rings?)\b/i,
    evidence: (e) => stated(e, /\b(campfires?|fire ?pits?|fire rings?)\b/i),
    role: "outside",
    prefer: /\b(provincial park|regional park|campground|forest)\b/i,
    none: "Nothing near here says it allows campfires. Check the fire bans before you light one anywhere.",
  },
  {
    id: "stars",
    label: "The stars",
    words:
      /\b(stars|stargaz\w*|night sky|dark sky|astronom\w*|milky way|observatory|telescopes?|northern lights|aurora)\b/i,
    evidence: (e) => {
      const listed = byActivity("stargazing")(e);
      return listed.length > 0
        ? listed
        : stated(e, /\b(observator\w*|astronom\w*|dark sky)\b/i);
    },
    role: "night",
    none: "Atlas lists no stargazing spot near here. A dark park after sunset is your call, not a listing.",
  },
  {
    id: "woods",
    label: "The woods",
    words:
      /\b(woods|forests?|trees|trails?|hikes?|hiking|walk in the|nature walk)\b/i,
    evidence: byActivity("hiking"),
    role: "outside",
    none: "Atlas lists no trail near here.",
    prefer:
      /\b(trails?|forest|provincial park|regional park|nature|mountain|canyon|wilderness|protected area|ecological|conservation|creek|falls)\b/i,
  },
  {
    id: "warm-drink",
    label: "Something warm to drink",
    words:
      /\b(hot chocolate|hot cocoa|cocoa|hot apple cider|mulled wine|warm drinks?|coffee|latte|tea)\b/i,
    evidence: byActivity("coffee"),
    role: "drink",
    none: "Atlas lists no café near here.",
  },
  {
    id: "dinner",
    label: "An incredible dinner",
    words:
      /\b(restaurants?|dinner|fine dining|somewhere to eat|place to eat|a meal|supper|tasting menu|steak ?house)\b/i,
    evidence: (e) => {
      const listed = byActivity("restaurants")(e);
      if (listed.length === 0) return [];
      if (NOT_A_DINNER.test(`${e.subtype ?? ""} ${e.title}`)) return [];
      return listed;
    },
    role: "meal",
    none: "Atlas lists no restaurant near here.",
  },
];

/**
 * **The ingredients a sentence names**, in the order it names them — the
 * named few first, then any other activity ADR 007 recognises ("skating",
 * "a museum"), each once.
 */
export function ingredientsIn(said: string): Ingredient[] {
  const text = said.toLowerCase();
  const found: { at: number; ingredient: Ingredient }[] = [];
  let rest = text;
  for (const ingredient of INGREDIENTS) {
    const match = ingredient.words.exec(rest);
    if (!match) continue;
    found.push({ at: match.index, ingredient });
    // A phrase answers once: "hot chocolate" is a drink, not also a *hot spring*.
    rest =
      rest.slice(0, match.index) +
      " ".repeat(match[0].length) +
      rest.slice(match.index + match[0].length);
  }
  // Anything else ADR 007 names, read from what is left, phrase by phrase.
  for (const part of rest.split(/[,.;!?]|\band\b|\bthen\b|\bwith\b/)) {
    const activity = activityIn(part);
    if (!activity || TOO_BROAD.has(activity.key)) continue;
    if (found.some((f) => f.ingredient.id === activity.key)) continue;
    found.push({
      at: text.indexOf(part.trim()),
      ingredient: fromActivity(activity),
    });
  }
  return found.sort((a, b) => a.at - b.at).map((f) => f.ingredient);
}

/**
 * Whole shelves of the taxonomy ("outdoors", "food") are moods, not things to
 * find — the brief reads them — and "eat" is any food at all.
 */
const TOO_BROAD = new Set([
  "outdoors",
  "adventure",
  "water",
  "winter",
  "culture",
  "entertainment",
  "family",
  "food",
  "relaxation",
  "eat",
]);

const ROLE_BY_KEY: Readonly<Record<string, Role>> = {
  restaurants: "meal",
  coffee: "drink",
  bars: "night",
  breweries: "drink",
  wine: "drink",
  wineries: "drink",
  "live-music": "night",
  comedy: "night",
  live: "night",
  theatre: "night",
  movies: "night",
  stargazing: "night",
  hiking: "outside",
  viewpoints: "outside",
  camping: "outside",
};

export function fromActivity(activity: Activity): Ingredient {
  return {
    id: activity.key,
    label: activity.label,
    words: new RegExp(`\\b${activity.key}\\b`, "i"),
    evidence: byActivity(activity.key),
    role: ROLE_BY_KEY[activity.key] ?? "do",
    none: `Atlas lists nowhere near here for ${activity.label.toLowerCase()}.`,
  };
}

export const ingredientById = (id: string): Ingredient | undefined =>
  INGREDIENTS.find((i) => i.id === id) ??
  (() => {
    const activity = ACTIVITIES.find((a) => a.key === id);
    return activity ? fromActivity(activity) : undefined;
  })();

/** A dinner somebody would call incredible: a real restaurant, not a quick bite. */
export const special = (e: Experience): boolean =>
  !EVERYDAY_FOOD.test(`${e.subtype ?? ""} ${e.title}`);

export const isAccommodation = (e: Experience): boolean =>
  Boolean(e.subtype && ACCOMMODATION.test(e.subtype.trim()));

/** For tests and the card: every word this place is listed under. */
export const listedWords = textOf;
