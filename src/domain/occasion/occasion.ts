import type { Experience } from "@/domain/experience/types";
import { readChristmas } from "@/domain/christmas/themes";
import { readWhen } from "@/domain/christmas/when";
import {
  activityByKey,
  activityEvidence,
  doesActivity,
  inSeason,
} from "@/domain/discovery/activities";
import { clockWords, statedCloseOn } from "./hours";

/**
 * **What kind of time somebody is asking for — not only what to do.**
 *
 * > "A fun romantic Christmas date night with mulled wine or hot apple
 * > cider, Christmas lights, maybe snow, something cute, cozy and
 * > memorable."
 *
 * The Day Builder used to read two words out of that sentence — _food_ and
 * _wine_ — and built Polson Park, McDonald's and The Perch Winery at 8:45 pm
 * from them (Vernon, a real result, 2026-11-01). Every stop was a real place;
 * none of them was the evening that was asked for. What was missing was the
 * **occasion**: who it is for, the atmosphere, and the few concrete things
 * named in passing (_mulled wine_, _lights_, _snow_).
 *
 * ## What this module is allowed to do
 *
 * It **ranks and explains**; it never removes and never states a fact.
 *
 * - The moods and wants are **Passport's reading of the person's words** —
 *   a closed set, read deterministically, said back on screen ("Heard: a
 *   romantic evening · something warm to drink · Christmas lights").
 * - Whether a place fits is judged only from **what Atlas states about it**:
 *   its subtype, the activities it lists, its own description, its published
 *   facts. A café is a café because Atlas says so; "probably has hot
 *   chocolate" is said as a likelihood, never as a menu.
 * - There is **no brand list**. McDonald's sinks on a date because Atlas
 *   calls it a `fast_food_restaurant` and fast food is not what a romantic
 *   evening asked for. Say "McDonald's" and it is a named interest that
 *   wins, like any other.
 * - The clock is arithmetic (`afterDark` from the sun's own time). That a
 *   winery or a café usually closes before an evening is **Passport's
 *   caution**, labelled as one and paired with "Atlas has no hours for it" —
 *   it moves the place down and tells the person to check, and it never
 *   claims a closing time.
 */

export type Mood =
  | "romantic"
  | "cozy"
  | "festive"
  | "family"
  | "lively"
  | "snowy"
  | "adventurous";

export type WantId =
  "warm-drink" | "lights" | "snow" | "sweet" | "dinner" | "market" | "show";

export interface Want {
  readonly id: WantId;
  /** The person's own words for it, as typed. */
  readonly said: string;
}

export interface Occasion {
  readonly moods: readonly Mood[];
  readonly wants: readonly Want[];
}

const MOODS: readonly (readonly [Mood, RegExp])[] = [
  [
    "romantic",
    /\bromantic\b|\bromance\b|\bdate (?:night|day)\b|\b(?:on a|first|a) date\b|\banniversary\b|\bproposal\b|\bvalentine/,
  ],
  [
    "cozy",
    /\bcozy\b|\bcosy\b|\bwarm(?: up)?\b|\bsnug\b|\bintimate\b|\bfireside\b|\bfireplace\b|\bhygge\b|\bcute\b/,
  ],
  [
    "festive",
    /\bchristmas\b|\bxmas\b|\bfestive\b|\bholiday season\b|\byule\w*\b|\bsanta\b|\bwinter wonderland\b/,
  ],
  [
    "family",
    /\bkids?\b|\bchildren\b|\bfamily\b|\btoddlers?\b|\bgrandkids?\b|\bniece\b|\bnephew\b|year[-\s]?old/,
  ],
  [
    "lively",
    /\bfriends\b|\bthe (?:crew|gang|boys|girls|guys)\b|\bbuddies\b|\bparty\b|\bfun night\b|\bnight out\b|\bbachelor(?:ette)?\b/,
  ],
  [
    "snowy",
    /\bsnow(?:y|day| day)?\b|\bski(?:ing|s)?\b|\bsnowboard\w*\b|\bpowder\b|\bsnowshoe\w*\b|\btobogg?an\w*\b|\bsledd?(?:ing)?\b/,
  ],
  ["adventurous", /\badventur\w*\b|\bepic\b|\bthrill\w*\b/],
];

/**
 * **The concrete things named in passing.** Each pattern is a phrase the
 * Day Builder would otherwise misread word by word ("mulled **wine**" became
 * a winery), so `occasionPhrases` hands them back for the brief to set
 * aside before it reads activities.
 */
const WANTS: readonly (readonly [WantId, RegExp])[] = [
  [
    "warm-drink",
    /\bmulled (?:wine|cider)\b|\bhot (?:apple )?cider\b|\bwarm (?:apple )?cider\b|\bhot (?:chocolate|cocoa|toddy|toddies)\b|\bcocoa\b|\bgl[uü]hwein\b|\begg ?nog\b|\bsomething warm(?: to drink)?\b|\bwarm drinks?\b/,
  ],
  [
    "lights",
    /\b(?:christmas |holiday |festive |twinkl\w* )?lights?\b(?! rail)|\blight (?:display|show|walk|festival)s?\b|\billuminat\w*\b/,
  ],
  ["snow", /\bsnow\w*\b/],
  [
    "sweet",
    /\bdesserts?\b|\btreats?\b|\bsweets?\b|\bpastr(?:y|ies)\b|\bbaking\b|\bbakery\b|\bcookies?\b|\bchocolates?\b(?! (?:hot|cocoa))|\bgingerbread\b/,
  ],
  [
    "dinner",
    /\bdinner\b|\bsupper\b|\bnice meal\b|\bsomewhere to eat\b|\bgood food\b/,
  ],
  ["market", /\bmarkets?\b|\bcraft fairs?\b/],
  [
    "show",
    /\bshows?\b|\bconcerts?\b|\bcarols?\b|\bnutcracker\b|\btheatre\b|\btheater\b|\bperformance\b/,
  ],
];

/** Phrases the brief should not read word by word ("mulled wine" is not a winery). */
const CONSUMED =
  /\bmulled (?:wine|cider)\b|\bhot (?:apple )?cider\b|\bwarm (?:apple )?cider\b|\bhot (?:chocolate|cocoa)\b|\bchristmas lights?\b|\bholiday lights?\b/g;

/** The sentence with the occasion's own phrases blanked, for the activity reader. */
export function withoutOccasionPhrases(text: string): string {
  return text.replace(CONSUMED, (m) => " ".repeat(m.length));
}

/**
 * **Read the occasion from what somebody said.** `undefined` when the
 * sentence names none — the Day Builder then behaves exactly as it did.
 */
export function readOccasion(said: string): Occasion | undefined {
  const text = said.toLowerCase().replace(/[’']/g, "'");
  const moods = MOODS.filter(([, p]) => p.test(text)).map(([m]) => m);
  const wants: Want[] = [];
  for (const [id, pattern] of WANTS) {
    const m = pattern.exec(text);
    if (m) wants.push({ id, said: m[0] });
  }
  // "Snowy" and "snow" are one wish said twice; keep the want, it is concrete.
  if (moods.length === 0 && wants.length === 0) return undefined;
  return { moods, wants };
}

/**
 * **Whether the occasion shapes the plan, or only leans it.** Who is going
 * ("with the kids", "with friends") is already the Day Builder's party and
 * only reorders. An atmosphere (romantic, cozy, festive, snowy) or a thing
 * named in passing shapes the outing: one dinner, nothing that argues
 * against it, and a shorter plan before a filler.
 */
export function shapesThePlan(occasion: Occasion | undefined): boolean {
  if (!occasion) return false;
  return (
    occasion.wants.length > 0 ||
    occasion.moods.some((m) => m !== "family" && m !== "lively")
  );
}

/** Two occasions, the later one's additions kept (a revision adds; it does not reset). */
export function mergeOccasion(
  before: Occasion | undefined,
  after: Occasion | undefined,
): Occasion | undefined {
  if (!before) return after;
  if (!after) return before;
  return {
    moods: [...new Set([...before.moods, ...after.moods])],
    wants: [
      ...before.wants,
      ...after.wants.filter((w) => !before.wants.some((b) => b.id === w.id)),
    ],
  };
}

const MOOD_WORDS: Readonly<Record<Mood, string>> = {
  romantic: "romantic",
  cozy: "cozy",
  festive: "festive",
  family: "for the family",
  lively: "lively",
  snowy: "snowy",
  adventurous: "adventurous",
};

const WANT_WORDS: Readonly<Record<WantId, string>> = {
  "warm-drink": "something warm to drink",
  lights: "Christmas lights",
  snow: "snow",
  sweet: "a treat",
  dinner: "a good dinner",
  market: "a market",
  show: "a show",
};

/** "romantic, cozy, festive · something warm to drink · Christmas lights" — what Passport heard. */
export function heardLine(occasion: Occasion): string {
  // "Snowy" and "snow" are one wish; say it once.
  const moods = occasion.moods
    .filter(
      (m) => !(m === "snowy" && occasion.wants.some((w) => w.id === "snow")),
    )
    .map((m) => MOOD_WORDS[m]);
  const wants = occasion.wants.map((w) => WANT_WORDS[w.id]);
  return [moods.join(", "), ...wants].filter(Boolean).join(" · ");
}

export const wantLabel = (id: WantId): string => WANT_WORDS[id];

// ------------------------------------------------------------- the places

/**
 * **What a stop is for, in an outing** — from Atlas's subtype only. A meal,
 * a treat, a drink, something to do, being outside, or somewhere to sleep.
 * Used to compose an evening (one dinner, not two) and to order it.
 */
export type Role = "meal" | "treat" | "drink" | "do" | "outside" | "stay";

const subtypeOf = (e: Experience) =>
  (e.subtype ?? "").toLowerCase().replace(/[_-]+/g, " ");

const MEAL =
  /\b(restaurant|bistro|eatery|diner|pizzeria|steakhouse|brasserie|trattoria|izakaya|ramen|sushi|noodle|grill|kitchen|food hall|gastropub|dining)\b/;
const TREAT =
  /\b(caf[eé]s?|coffee ?(shop|house)?|coffeehouse|espresso|tea ?(room|house|shop)|bakery|patisserie|p[aâ]tisserie|chocolate|chocolatier|dessert|ice cream|gelato|donut|doughnut|candy|confection\w*|sweets)\b/;
const DRINK =
  /\b(bar|pub|lounge|tavern|taproom|brew ?pub|brewery|winery|vineyard|cidery|cider|distillery|wine bar|tasting room|meadery)\b/;
const OUTSIDE =
  /\b(park|trail|beach|lake|viewpoint|lookout|bay|creek|river|provincial park|nature|garden|waterfall|campground|boat launch|sports field|dog park|picnic|outdoor|field|playground)\b/;
const STAY =
  /\b(hotel|motel|inn|lodge|resort|bed (and|&) breakfast|b ?& ?b|hostel|rv park|guest ?house|cabins?)\b/;

export function roleOf(e: Experience): Role {
  const s = subtypeOf(e);
  // A ski, bike or golf resort is somewhere you go and do, not a bed.
  if (/\b(ski|bike|golf|tube|nordic|spa)\b/.test(s)) return "do";
  if (STAY.test(s) && !MEAL.test(s)) return "stay";
  if (TREAT.test(s)) return "treat";
  if (MEAL.test(s)) return "meal";
  if (DRINK.test(s)) return "drink";
  if (OUTSIDE.test(s)) return "outside";
  return "do";
}

const FAST_FOOD =
  /\b(fast ?food|quick service|drive[- ]?thru|drive[- ]?through|food court|take ?out|takeaway|food truck)\b/;
const SPORTS_BAR = /\bsports? (bar|club|pub)\b/;
const NOT_AN_OUTING =
  /\b(school|elementary|secondary|hospital|clinic|program|church|office|government|association|society|club house|storage|bank|dealership)\b/;
const ADULT_ONLY =
  /\b(bar|pub|lounge|tavern|nightclub|winery|vineyard|cidery|distillery|brewery|taproom|casino|wine bar)\b|\b(16|18|19)\+|adults? only/;
const ROMANTIC_KIND =
  /\b(bistro|wine bar|lounge|french|italian|tapas|fondue|steakhouse|fine dining|chocolat\w*|patisserie|p[aâ]tisserie|tea ?room|spa|hot springs?|gallery|art gallery|viewpoint|lookout|dessert)\b/;
const COZY_WORDS =
  /\b(cozy|cosy|intimate|candle ?lit|candlelight|fireplace|fireside|romantic|charming|warm and welcoming|rustic|hearth)\b/i;
const WARM_DRINK_WORDS =
  /\b(mulled (?:wine|cider)|hot (?:apple )?cider|hot chocolate|cocoa|hot toddy|gl[uü]hwein|egg ?nog|apple cider|warm drinks?)\b/i;

const VENUE =
  /\b(theat(re|er)s?|concert hall|venue|auditorium|performance|music concert|concert|performing arts|playhouse|opera)\b/;

/** Daytime-shaped kinds: often closed by an evening. Passport's caution, never a claim. */
const DAYTIME =
  /\b(winery|vineyard|cidery|tasting room|caf[eé]s?|coffee ?(shop|house)?|coffeehouse|bakery|patisserie|chocolate\w*|tea ?(room|house|shop)|market|farm|orchard|museum|gallery|library|garden|nursery|shop|store|boutique)\b/;

const KIND_WORDS: readonly (readonly [RegExp, string])[] = [
  [/\bwiner(y|ies)|vineyard|tasting room\b/, "Wineries"],
  [/\bcider|cidery\b/, "Cideries"],
  [/\bcaf[eé]|coffee|espresso|tea ?(room|house|shop)\b/, "Cafés"],
  [/\bbakery|patisserie|p[aâ]tisserie\b/, "Bakeries"],
  [/\bchocolat\w*\b/, "Chocolate shops"],
  [/\bmarket\b/, "Markets"],
  [/\bfarm|orchard\b/, "Farms"],
  [/\bmuseum\b/, "Museums"],
  [/\bgallery\b/, "Galleries"],
  [/\blibrary\b/, "Libraries"],
  [/\bgarden|nursery\b/, "Gardens"],
  [/\bshop|store|boutique\b/, "Shops"],
];

const kindWord = (e: Experience): string =>
  KIND_WORDS.find(([p]) => p.test(subtypeOf(e)))?.[1] ?? "Places like this";

/** Everything Atlas says about a subject in words, for the cozy / warm-drink readings. */
function ownWords(e: Experience): string {
  const parts = [
    e.title,
    e.knowledge?.descriptionAddsKnowledge === false ? "" : e.description,
    e.shortDescription,
    ...(e.knowledge?.affordances ?? []).map((a) => a.name ?? ""),
    ...(e.knowledge?.features ?? []),
    ...(e.knowledge?.practical ?? []).map((p) => `${p.label}: ${p.value}`),
  ];
  return parts.filter(Boolean).join(" . ");
}

/** The words a regex found, quoted as Atlas holds them. */
function found(pattern: RegExp, text: string): string | undefined {
  return pattern.exec(text)?.[0];
}

const SEASON_SHUT =
  /\bclosed (?:for|until) the (?:season|spring|summer|winter)\b|\bseason(?:al)? closure\b/i;

const DAWN_TO_DUSK =
  /\b(?:dawn|sunrise) (?:to|till|until|[-–]) (?:dusk|sunset)\b|\bdaylight hours\b/i;

/** A ski hill, a Nordic centre, a toboggan run — by Atlas's words or subtype. */
export function isSnowPlace(e: Experience): boolean {
  return (
    SNOW_ACTIVITIES.some((k) => doesActivity(e, k)) ||
    /\b(ski|nordic|snow ?park|tube park|tubing)\b/.test(subtypeOf(e))
  );
}

const SNOW_ACTIVITIES = [
  "skiing",
  "snowboarding",
  "snowshoeing",
  "cross-country-skiing",
  "sledding",
] as const;

export interface FitContext {
  /** The whole outing is after sunset (arithmetic from the sun). */
  readonly afterDark?: boolean;
  /** `YYYY-MM-DD`, the day it happens — for dates and stated hours. */
  readonly on?: string;
  /** When the outing starts, minutes after midnight, where known. */
  readonly startAt?: number;
}

export interface OccasionFit {
  /** Added to the Day Builder's score. Ranking only. */
  readonly score: number;
  /** Why it fits, in a sentence built from what Atlas states. */
  readonly why?: string;
  /** What to check before going — a Passport caution, said as one. */
  readonly caution?: string;
  /** Which of the occasion's wants Atlas's own words support here. */
  readonly meets: readonly WantId[];
  /** It sits badly with the occasion (fast food on a date). Never removed. */
  readonly against?: string;
  /**
   * The caution is about the clock — it may well be shut by then. Such a
   * place is never a filler; the person can still add it by hand.
   */
  readonly closedRisk?: true;
}

/** Evening service, in a business's own published words — most telling first. */
const EVENING_SERVICE: readonly RegExp[] = [
  /\b(?:late )?evening specials?\b|\bdinner(?: service| menu)?\b|\bsupper\b/i,
  /\b(?:open )?(?:late|evenings?|nightly)\b|\blate[- ]night\b/i,
  /\bhappy hours?\b|\bcocktails?\b/i,
];
/** Something you can do outside after dark, in a place's own name or activities. */
const LIT =
  /\b(lights?|lit|illuminat\w*|lantern\w*|glow\w*|night|evening|moonlight|stargaz\w*|torch\w*|skating|ice skat\w*|rink)\b/i;

/** The words Atlas lists a subject *as*: its name, activities and features. */
const listedWords = (e: Experience): string =>
  [
    e.title,
    ...(e.knowledge?.affordances ?? []).map((a) => a.name ?? ""),
    ...(e.knowledge?.features ?? []),
  ].join(" . ");

/** What a business publishes about itself: its practical facts and description. */
const publishedWords = (e: Experience): string =>
  [
    e.knowledge?.descriptionAddsKnowledge === false
      ? ""
      : (e.description ?? ""),
    ...(e.knowledge?.practical ?? []).map((p) => `${p.label}: ${p.value}`),
  ].join(" . ");

const ROLE_LEAD: Readonly<Record<Role, string>> = {
  meal: "Dinner",
  treat: "Something warm or sweet",
  drink: "A drink",
  do: "Something to do",
  outside: "Out in the open",
  stay: "Somewhere to stay",
};

/**
 * **How well one place fits the occasion**, and why — from Atlas's words.
 *
 * The weights are deliberately coarse: a fit is worth about as much as a
 * named interest (6) so the occasion decides between plausible places and
 * never overrides something the person asked for by name. The one strong
 * weight is a place's **own stated hours** saying it is shut by then.
 */
export function fitOccasion(
  e: Experience,
  occasion: Occasion,
  context: FitContext = {},
): OccasionFit {
  const has = (m: Mood) => occasion.moods.includes(m);
  const wants = (w: WantId) => occasion.wants.some((x) => x.id === w);
  const s = subtypeOf(e);
  const role = roleOf(e);
  const words = ownWords(e);
  const published = publishedWords(e);
  let score = 0;
  const why: string[] = [];
  const meets: WantId[] = [];
  let against: string | undefined;
  let caution: string | undefined;
  let closedRisk = false;

  const intimate = has("romantic") || has("cozy");

  // ---- what it is, against the mood
  if (FAST_FOOD.test(s)) {
    if (intimate) {
      score -= 10;
      against = "Atlas lists it as fast food — quick, not a date.";
    } else if (has("festive")) score -= 3;
  }
  if (NOT_AN_OUTING.test(s) || NOT_AN_OUTING.test(e.title.toLowerCase())) {
    score -= 8;
    against ??= "Not somewhere you'd go for an outing.";
  }
  if (role === "stay") score -= 6;
  if (intimate && SPORTS_BAR.test(`${s} ${e.title.toLowerCase()}`)) score -= 4;

  // **A venue is not an evening; its show is.** Atlas lists theatres and
  // halls as places and their performances as Events. A dated performance
  // has already passed the day's schedule rules; the building alone has not.
  const venue = VENUE.test(s);
  if (venue && e.kind === "Event") {
    score += intimate || has("festive") ? 6 : 3;
    why.push("A performance Atlas lists for this day");
  } else if (venue) {
    score -= 4;
    caution ??=
      "Atlas lists the venue, not what's on — check the programme for that night.";
  }

  if (intimate) {
    const kind = found(ROMANTIC_KIND, s);
    if (kind) {
      score += 5;
      why.push(`${ROLE_LEAD[role]} at a ${s}`);
    }
    const cozy = found(COZY_WORDS, words);
    if (cozy) {
      score += 3;
      why.push(`Atlas describes it as “${cozy.toLowerCase()}”`);
    }
  }

  if (has("family")) {
    if (ADULT_ONLY.test(`${s} ${e.title.toLowerCase()}`)) {
      score -= 7;
      against ??= "Atlas lists it as somewhere for grown-ups.";
    }
    if (FAST_FOOD.test(s)) score += 1;
  }

  if (has("lively")) {
    if (
      /\b(bowling|arcade|games|escape|axe|karaoke|brewery|taproom|pub|bar)\b/.test(
        s,
      )
    ) {
      score += 3;
      why.push(`a ${s}`);
    }
  }

  // ---- Christmas, on the day: a Christmas thing is only a fit when Atlas's
  // dates put it on this day, or hold none either way (then: check).
  const christmas = has("festive") || wants("lights") || wants("market");
  const reading = christmas ? readChristmas(e) : null;
  const when = reading && context.on ? readWhen(e, context.on) : undefined;
  const onTheDay =
    when?.confidence === "dated" &&
    when.from !== undefined &&
    when.to !== undefined &&
    context.on !== undefined &&
    when.from <= context.on &&
    when.to >= context.on;
  const seasonal =
    reading && (!when || onTheDay || when.confidence === "check");
  if (
    reading &&
    when &&
    (when.confidence === "past" || (when.confidence === "dated" && !onTheDay))
  ) {
    score -= 6;
  } else if (reading?.christmas && seasonal) {
    score += onTheDay ? 9 : 2;
    why.push(
      onTheDay
        ? `Atlas dates it to this day — “${reading.evidence[0]?.word ?? "Christmas"}”`
        : `Atlas ties it to the season — “${reading.evidence[0]?.word ?? "Christmas"}”`,
    );
    if (!onTheDay)
      caution ??=
        "Atlas doesn't hold this season's dates for it — check it's on before you go.";
  } else if (reading?.christmas && when?.confidence === "unconfirmed") {
    score += 1;
    caution ??=
      "Atlas doesn't hold this season's dates for it — check it's on before you go.";
  }
  const lightsHere =
    reading?.themes.includes("lights") &&
    when?.confidence !== "past" &&
    !(when?.confidence === "dated" && !onTheDay);
  if (wants("lights") && lightsHere) {
    score += 6;
    meets.push("lights");
  }
  if (
    wants("market") &&
    (reading?.themes.includes("markets") || doesActivity(e, "markets")) &&
    when?.confidence !== "past"
  ) {
    score += 4;
    meets.push("market");
  }

  // ---- the named wants
  if (wants("warm-drink")) {
    const stated = found(WARM_DRINK_WORDS, words);
    if (stated) {
      score += 9;
      meets.push("warm-drink");
      why.push(`Atlas mentions “${stated.toLowerCase()}”`);
    } else if (/\bcider|cidery\b/.test(s)) {
      score += 4;
      meets.push("warm-drink");
      why.push("a cidery — whether it pours it hot isn't listed");
    } else if (role === "treat" && !/\bbakery|donut|doughnut\b/.test(s)) {
      score += 4;
      meets.push("warm-drink");
      why.push(
        `${/chocolat/.test(s) ? "a chocolate shop" : "a café"} — hot chocolate's a good bet, though Atlas doesn't list a menu`,
      );
    }
  }
  if (wants("sweet") && role === "treat") {
    score += 4;
    meets.push("sweet");
  }
  if (wants("dinner") && role === "meal" && !FAST_FOOD.test(s)) {
    score += 3;
    meets.push("dinner");
  }
  if (
    wants("show") &&
    (/\b(theat(re|er)|concert|music|perform|show|ballet|dance|choir|carol)\w*/.test(
      s,
    ) ||
      doesActivity(e, "live"))
  ) {
    score += 5;
    meets.push("show");
  }
  // Snow is a season before it is a wish: in early November nobody is
  // offered a ski hill as the evening's stop (`inSeason`'s calendar).
  const snowSeason = inSeason(activityByKey("skiing")!, context.on);
  if ((wants("snow") || has("snowy")) && isSnowPlace(e)) {
    if (snowSeason) {
      score += 6;
      meets.push("snow");
      const listed = SNOW_ACTIVITIES.flatMap((k) =>
        activityEvidence(e, activityByKey(k)!),
      )[0];
      why.push(
        listed
          ? `Atlas lists “${listed.toLowerCase()}” here`
          : `a ${s} — Atlas doesn't list runs or conditions`,
      );
    } else {
      score -= 6;
      caution ??=
        "Snow season usually starts in December — Atlas holds no opening date for this one.";
    }
  }
  const skating = activityEvidence(e, activityByKey("skating")!);
  if (skating.length > 0) {
    if (wants("snow") || has("snowy") || has("festive") || intimate) score += 3;
    why.push(
      `Atlas lists “${skating[0]!.toLowerCase()}” here — public-skate times aren't in Atlas, so check them first`,
    );
  }

  // ---- the season: a place's own note that it is shut for the season.
  const shut = found(SEASON_SHUT, published);
  if (shut) {
    score -= 20;
    closedRisk = true;
    caution = `Its own note says “${shut.toLowerCase()}” — check it has reopened.`;
  }

  // ---- the clock
  const close = context.on ? statedCloseOn(e, context.on) : undefined;
  const start = context.startAt;
  if (close && start !== undefined) {
    if (close.closed || close.minutes <= start + 45) {
      score -= 20;
      closedRisk = true;
      caution = close.closed
        ? `Its own hours say it's closed that day (“${close.quote}”).`
        : `Its own hours say it closes at ${clockWords(close.minutes)} that day (“${close.quote}”).`;
    } else if (context.afterDark) {
      score += 3;
      why.push(
        `open till ${clockWords(close.minutes)} that day, by its own hours`,
      );
    }
  } else if (context.afterDark && DAWN_TO_DUSK.test(published)) {
    score -= 20;
    closedRisk = true;
    caution = `Its own hours say “${found(DAWN_TO_DUSK, published)!.toLowerCase()}”, and it'll be dark by then.`;
  } else if (context.afterDark) {
    const evening = EVENING_SERVICE.map((p) => found(p, published)).find(
      Boolean,
    );
    if (role === "outside") {
      if (!lightsHere && !LIT.test(listedWords(e))) {
        score -= 10;
        closedRisk = true;
        caution =
          "It'll be dark by then, and Atlas says nothing about lighting here.";
      }
    } else if (evening && role !== "stay") {
      score += 3;
      why.push(`Atlas says it does “${evening.toLowerCase()}”`);
    } else if (DAYTIME.test(s) && !LIT.test(listedWords(e))) {
      score -= 6;
      closedRisk = true;
      caution = `${kindWord(e)} often close before evening, and Atlas has no hours for this one. Check before you go.`;
    }
  }

  return {
    score,
    ...(why.length > 0 ? { why: sentence(why) } : {}),
    ...(caution ? { caution } : {}),
    meets: [...new Set(meets)],
    ...(against ? { against } : {}),
    ...(closedRisk ? { closedRisk: true as const } : {}),
  };
}

const sentence = (parts: readonly string[]): string => {
  const [first, ...rest] = parts;
  const head = first!.charAt(0).toUpperCase() + first!.slice(1);
  return `${[head, ...rest].join("; ")}.`;
};

/**
 * **Whether a whole outing starting at `startAt` is after dark**, by the
 * sun at the start — arithmetic, never a forecast. Without a place and a day
 * an evening start (6 pm or later) is read as dark from October to March.
 */
export function afterDarkAt(input: {
  readonly startAt?: number;
  readonly on?: string;
  readonly sunsetMinutes?: number;
}): boolean {
  if (input.startAt === undefined) return false;
  if (input.sunsetMinutes !== undefined)
    return input.startAt >= input.sunsetMinutes - 20;
  const month = input.on ? Number(input.on.slice(5, 7)) : undefined;
  const darkEarly = month === undefined || month >= 10 || month <= 3;
  return input.startAt >= (darkEarly ? 18 * 60 : 21 * 60);
}

/**
 * **The shape of an evening out**: dinner first while kitchens are open,
 * then the thing to do, then something warm or sweet to finish. Only used
 * when the outing is after dark and the person set no order; the stops are
 * the same stops.
 */
export function eveningOrder(stops: readonly Experience[]): Experience[] {
  const rank: Readonly<Record<Role, number>> = {
    meal: 0,
    do: 1,
    outside: 1,
    drink: 2,
    treat: 3,
    stay: 4,
  };
  return [...stops]
    .map((e, i) => ({ e, i }))
    .sort((a, b) => rank[roleOf(a.e)] - rank[roleOf(b.e)] || a.i - b.i)
    .map(({ e }) => e);
}
