import type { Party } from "./discover";
import { agesIn, dayIn, townIn } from "./sentence";

/**
 * **"Romantic night of lights, dinner and a movie."** — what was asked for.
 *
 * The Christmas planner used to read a sentence into one *shape* ("an
 * evening") and hand the Day Builder "a Christmas evening, good food and
 * drink" — so a night of lights, dinner and a movie came back as three
 * restaurants (owner brief, Christmas Experience 2.0, 2026-11-14). This
 * reads the sentence into the **parts** somebody asked for — each of which
 * the itinerary must satisfy or say it can't — and the few facts that shape
 * a day: when, where from, who, how much, how they get around.
 *
 * Doctrine §5: what was **said** and what Passport **adds** are kept apart.
 * A part the person named is `said`; one Passport suggests because nothing
 * was named (a romantic evening with no parts gets dinner and the lights) is
 * not, and the page says so. A word it doesn't recognise is left alone —
 * never guessed into a part.
 */

export type Need =
  | "breakfast"
  | "lunch"
  | "dinner"
  | "coffee"
  | "drinks"
  | "movie"
  | "lights"
  | "market"
  | "santa"
  | "skating"
  | "show"
  | "festival";

export const NEEDS: readonly Need[] = [
  "breakfast",
  "lunch",
  "dinner",
  "coffee",
  "drinks",
  "movie",
  "lights",
  "market",
  "santa",
  "skating",
  "show",
  "festival",
];

export const isNeed = (s: string): s is Need =>
  (NEEDS as readonly string[]).includes(s);

/** What each part is called on the itinerary, and its emoji. */
export const NEED_LABEL: Readonly<Record<Need, string>> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  coffee: "Hot chocolate & coffee",
  drinks: "A festive drink",
  movie: "Movie",
  lights: "Christmas lights",
  market: "Christmas market",
  santa: "Visit Santa",
  skating: "Skating",
  show: "A Christmas show",
  festival: "Christmas festival",
};

export const NEED_EMOJI: Readonly<Record<Need, string>> = {
  breakfast: "🥞",
  lunch: "🥪",
  dinner: "🍽️",
  coffee: "☕",
  drinks: "🥂",
  movie: "🎬",
  lights: "✨",
  market: "🎪",
  santa: "🎅",
  skating: "⛸️",
  show: "🎭",
  festival: "🎄",
};

/**
 * The words for each part. Order matters only for overlaps, which are
 * removed before reading: "movie theatre" is a movie, not a show; a
 * "light-up" is a festival, not the lights.
 */
const WORDS: Readonly<Record<Need, RegExp>> = {
  breakfast: /\b(breakfast|brunch|pancakes?)\b/,
  lunch: /\blunch\b/,
  dinner: /\b(dinner|supper|dine|dining|a meal|eat out|restaurant)\b/,
  coffee:
    /\b(coffee|hot chocolate|hot cocoa|cocoa|latte|caf[eé]s?|something warm)\b/,
  drinks:
    /\b(drinks?|cocktails?|a pint|pints|pub|nightcap|mulled wine|eggnog|a glass of wine)\b/,
  movie: /\b(movies?|cinema|films?|flicks?|the pictures)\b/,
  lights:
    /\b(lights|light displays?|light tour|lights tour|light show|illuminations?|twinkl\w+)\b/,
  market: /\b(markets?|craft fairs?|bazaars?|christkindl\w*)\b/,
  santa: /\b(santa|north pole|reindeer|elves|elf)\b/,
  skating: /\b(skat(e|es|ing)|ice rinks?|skating rinks?)\b/,
  show: /\b(shows?|nutcracker|carols?|caroll?ing|concerts?|theatre|theater|panto(mime)?|a play|ballet|choir)\b/,
  festival:
    /\b(festivals?|tree lighting|light[- ]ups?|parades?|frostival|winter ?fest)\b/,
};

/** Overlaps read as something else first, removed before the parts are read. */
const OVERLAPS: readonly [RegExp, string][] = [
  [/\bmovie (theat(re|er)s?|house)\b/g, "movie"],
  [/\b(santa claus )?parades?\b/g, " festival "],
  [/\blight[- ]ups?\b/g, " festival "],
  [/\bfestival of lights\b/g, " lights festival "],
];

/** What somebody says when a place has to work for them: said back, never assumed. */
const ACCESS =
  /\b(wheelchairs?|step[- ]free|accessible|accessibility|walkers?|canes?|strollers?|prams?|buggy|buggies|mobility|no stairs|can'?t (?:do )?stairs|elevators?|ramps?)\b/;

export type TimeOfDay = "morning" | "afternoon" | "evening";

export interface Request {
  /** The words as said, trimmed. */
  readonly said: string;
  /** Each part, in the order said; `said: false` is Passport's suggestion. */
  readonly needs: readonly { readonly need: Need; readonly said: boolean }[];
  /** `YYYY-MM-DD`, when a day was said. */
  readonly day?: string;
  readonly time?: TimeOfDay;
  /** Minutes after midnight, when a start time was said ("at 5:30"). */
  readonly start?: number;
  /** Minutes after midnight, when "home by 9" was said. */
  readonly homeBy?: number;
  /** A town Passport knows, when one was named. */
  readonly at?: string;
  readonly party?: Party;
  /** How many people, when said ("the four of us", "for 2"). */
  readonly people?: number;
  /** How many children, when said ("two kids"). */
  readonly kids?: number;
  readonly ages: readonly number[];
  /** Dollars, when said. */
  readonly budget?: number;
  readonly mode: "drive" | "walk";
  /** An accessibility need, as said ("wheelchair", "a stroller", "no stairs"). */
  readonly access?: string;
  /** "within 20 minutes" / "under 15 km", as km of reach. */
  readonly reachKm?: number;
  readonly romantic: boolean;
  /** A tour of several displays was asked for, not one stop. */
  readonly tour: boolean;
}

const NUMBER: Readonly<Record<string, number>> = {
  a: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};
const NUM = String.raw`(\d{1,2}|a|one|two|three|four|five|six|seven|eight|nine|ten)`;
const num = (s: string) => NUMBER[s] ?? Number(s);

/** "5:30", "6pm", "at 7" → minutes after midnight. Evening is assumed for 1–11 with no am/pm. */
function clockIn(text: string, lead: RegExp): number | undefined {
  const m = text.match(
    new RegExp(
      `${lead.source}\\s*(\\d{1,2})(?::(\\d{2}))?\\s*(a\\.?m\\.?|p\\.?m\\.?)?(?![\\d$])`,
    ),
  );
  if (!m) return undefined;
  let hour = Number(m.at(-3));
  const min = Number(m.at(-2) ?? 0);
  const half = m.at(-1);
  if (hour > 23 || min > 59) return undefined;
  if (half) {
    hour %= 12;
    if (/p/.test(half)) hour += 12;
  } else if (hour >= 1 && hour <= 11) hour += 12;
  return hour * 60 + min;
}

function partyIn(text: string): Party | undefined {
  const kids =
    /\b(kids?|children|child|toddlers?|bab(y|ies)|family|daughters?|sons?|nieces?|nephews?|grandkids?|little ones|year[ -]olds?)\b/.test(
      text,
    );
  const couple =
    /\b(romantic|romance|date(?: night)?|anniversary|the two of us|just the two|us two|my (wife|husband|partner|girlfriend|boyfriend|fianc[eé]e?)|couple)\b/.test(
      text,
    );
  const friends =
    /\b(friends?|buddies|the (girls|boys|crew|gang)|mates|coworkers|colleagues)\b/.test(
      text,
    );
  const solo = /\b(just me|by myself|solo|on my own|alone)\b/.test(text);
  return kids
    ? "family"
    : couple
      ? "couple"
      : friends
        ? "friends"
        : solo
          ? "solo"
          : undefined;
}

/** What Passport suggests when nothing was named — said out loud as a suggestion. */
function suggested(read: {
  party?: Party;
  time?: TimeOfDay;
  romantic: boolean;
}): Need[] {
  if (read.romantic || read.party === "couple") return ["dinner", "lights"];
  if (read.party === "family") return ["santa", "skating", "lights"];
  if (read.party === "friends") return ["market", "drinks", "lights"];
  if (read.time === "evening") return ["dinner", "lights"];
  return ["market", "coffee", "lights"];
}

export function readRequest(input: string, today: string): Request {
  const said = input.replace(/\s+/g, " ").trim().slice(0, 240);
  let text = ` ${said.toLowerCase().replace(/[’']/g, "'")} `;
  for (const [pattern, to] of OVERLAPS) text = text.replace(pattern, to);

  const found = NEEDS.flatMap((need) => {
    const m = WORDS[need].exec(text);
    return m ? [{ need, at: m.index }] : [];
  });
  // "A show" said alongside a movie is the movie's.
  const needs = found
    .filter(
      (f) =>
        !(
          f.need === "show" &&
          found.some((g) => g.need === "movie") &&
          !/\b(nutcracker|carol|concert|panto|ballet|choir)/.test(text)
        ),
    )
    .sort((a, b) => a.at - b.at)
    .map((f) => ({ need: f.need, said: true }));

  const romantic =
    /\b(romantic|romance|date night|anniversary|cosy|cozy)\b/.test(text);
  const party = partyIn(text);
  const time: TimeOfDay | undefined =
    /\b(evening|tonight|night|after dark|after work|dinner|supper)\b/.test(text)
      ? "evening"
      : /\b(afternoon|lunch)\b/.test(text)
        ? "afternoon"
        : /\b(morning|breakfast|brunch)\b/.test(text)
          ? "morning"
          : undefined;
  const start =
    clockIn(text, /\b(?:at|from|around|start(?:ing)? at|leave at)/) ??
    undefined;
  const homeBy = clockIn(
    text,
    /\b(?:home by|home before|back by|back before|done by|finish by|finished by|finish before|no later than|until)/,
  );
  const access = text.match(ACCESS)?.[0];
  const day = dayIn(text, today);
  const at = townIn(text);

  const kidsMatch = text.match(
    new RegExp(
      `\\b${NUM}\\s+(?:little\\s+)?(?:kids|children|boys|girls|grandkids)\\b`,
    ),
  );
  const kids = kidsMatch ? num(kidsMatch[1]!) : undefined;
  const peopleMatch =
    text.match(new RegExp(`\\b(?:the|all)\\s+${NUM}\\s+of us\\b`)) ??
    text.match(
      new RegExp(
        `\\b(?:for|party of|group of|family of)\\s+${NUM}\\b(?!\\s*(?:pm|am|:|\\$))`,
      ),
    );
  const people = peopleMatch
    ? num(peopleMatch[1]!)
    : /\b(the two of us|just the two|us two)\b/.test(text) ||
        (party === "couple" && !kids)
      ? 2
      : undefined;
  const budgetMatch = text.match(
    /\$\s?(\d{1,5})\b|\b(\d{1,5})\s?(?:dollars|bucks)\b/,
  );
  const budget = budgetMatch
    ? Number(budgetMatch[1] ?? budgetMatch[2])
    : undefined;
  const mode = /\b(walk|walking|on foot|no car|no driving|stroll)\b/.test(text)
    ? "walk"
    : "drive";
  const minutes = text.match(/\bwithin (\d{1,3}) ?(?:min|minutes)\b/);
  const km = text.match(
    /\b(?:within|under) (\d{1,3}) ?(?:km|kilometres|kilometers)\b/,
  );
  const reachKm = km
    ? Number(km[1])
    : minutes
      ? Math.max(
          3,
          Math.round((Number(minutes[1]) / 60) * (mode === "walk" ? 4.5 : 40)),
        )
      : undefined;
  const tour =
    /\b(lights? tour|tour of (the )?lights|drive (around|through)|driving tour|drive[- ]by|look at (the )?lights|see (the |all the )?lights)\b/.test(
      text,
    );

  const base = {
    romantic,
    ...(party ? { party } : {}),
    ...(time ? { time } : {}),
  };
  return {
    said,
    needs: needs.length
      ? needs
      : suggested(base).map((need) => ({ need, said: false })),
    ...(day ? { day } : {}),
    ...(time ? { time } : {}),
    ...(start !== undefined ? { start } : {}),
    ...(homeBy !== undefined ? { homeBy } : {}),
    ...(at ? { at } : {}),
    ...(party ? { party } : {}),
    ...(people ? { people } : {}),
    ...(kids ? { kids } : {}),
    ages: agesIn(text),
    ...(budget ? { budget } : {}),
    mode,
    ...(access ? { access } : {}),
    ...(reachKm ? { reachKm } : {}),
    romantic,
    tour,
  };
}

/**
 * **The five quick starts** on the front page. Each is a sentence, read the
 * same way as anything typed — there is no second planner behind a button.
 */
export const QUICK_STARTS: readonly {
  readonly id: string;
  readonly label: string;
  readonly emoji: string;
  readonly say: string;
}[] = [
  {
    id: "romantic",
    label: "Romantic Christmas evening",
    emoji: "🌙",
    say: "A romantic Christmas evening — dinner and the lights",
  },
  {
    id: "family",
    label: "Family Christmas adventure",
    emoji: "👨‍👩‍👧",
    say: "A family Christmas adventure with the kids — Santa, skating and the lights",
  },
  {
    id: "lights",
    label: "Christmas lights tour",
    emoji: "✨",
    say: "A Christmas lights tour after dark",
  },
  {
    id: "markets",
    label: "Christmas markets",
    emoji: "🎪",
    say: "Christmas markets and a hot chocolate",
  },
  {
    id: "weekend",
    label: "This weekend",
    emoji: "📅",
    say: "This weekend — a Christmas market, lunch and the lights",
  },
];

/**
 * The four starts on the plan page, named the way people say them. Each is
 * one of the sentences above — the same reader, no second planner.
 */
export const PLAN_STARTS: readonly {
  readonly id: string;
  readonly label: string;
  readonly emoji: string;
  readonly say: string;
}[] = (
  [
    ["romantic", "Date Night"],
    ["family", "Family Fun"],
    ["lights", "Christmas Lights"],
    ["markets", "Christmas Markets"],
  ] as const
).map(([id, label]) => {
  const q = QUICK_STARTS.find((x) => x.id === id)!;
  return { ...q, label };
});

/** The itinerary's title, from what was asked. */
export function titleFor(r: Request): string {
  const evening =
    r.time === "evening" ||
    (!r.time &&
      !r.needs.some((n) =>
        ["breakfast", "lunch", "santa", "skating", "market"].includes(n.need),
      ));
  const span = evening ? "evening" : "day";
  if (r.romantic || r.party === "couple")
    return `Our romantic Christmas ${span}`;
  if (r.party === "family") return "Our family Christmas adventure";
  if (r.party === "friends") return `A Christmas ${span} with friends`;
  if (r.needs.length === 1 && r.needs[0]!.need === "lights")
    return "Our Christmas lights tour";
  if (r.needs.every((n) => n.need === "market" || n.need === "coffee"))
    return "Our Christmas market day";
  return `Our Christmas ${span}`;
}
