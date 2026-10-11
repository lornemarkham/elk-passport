import { DISCOVERY_TOWNS, type DiscoveryTown } from "@/domain/discovery/towns";
import type { Experience } from "@/domain/experience/types";

/**
 * **What a sentence is actually asking for.**
 *
 * M200's independent audit ran the sentences the release is built around and
 * found them misread in four different ways, all of the same kind: a *word*
 * was matched and its *meaning* was not.
 *
 * ```
 * "I have two hours free"          free is AVAILABLE TIME, not a $0 budget
 * "I'll drive two hours"           two hours is TRAVEL WILLINGNESS, not a 2 h day
 * "within 30 minutes of Kelowna"   MINUTES of travel, not 30 kilometres
 * "Scuba diving with sharks"       a REQUEST that nothing may quietly replace
 * ```
 *
 * Everything here is deterministic and reads only words the person typed.
 * It is the floor under any model (see `brief.ts`): a model, if one is ever
 * wired in, fills the same `DayBrief` and answers to the same checks.
 */

/**
 * **The one place Passport turns travel minutes into a planning circle.**
 *
 * Passport has no road routes of its own (`build.ts`): Atlas routes a leg
 * only after the stops are chosen. A person who says "within 30 minutes"
 * has still said minutes, so the circle is drawn from them with this stated
 * conversion — about 48 km/h of *straight-line* distance, which is a normal
 * road speed after the road's own detours — and the screen says it is an
 * estimate. It is a planning radius, not a drive time, and Atlas's routed
 * minutes replace it wherever they exist.
 *
 * **A human decision, recorded rather than buried:** this is a constant
 * somebody may want to tune per region or retire once Atlas can answer
 * "what is reachable in N minutes".
 */
export const PLANNING_KM_PER_MINUTE = 0.8;

export const kmForMinutes = (minutes: number): number =>
  Math.max(1, Math.round(minutes * PLANNING_KM_PER_MINUTE));

const NUMBER_WORDS: Readonly<Record<string, number>> = {
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
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  forty: 40,
  "forty-five": 45,
  fortyfive: 45,
  sixty: 60,
  ninety: 90,
};

const WORD_ALTERNATIVES = Object.keys(NUMBER_WORDS)
  .sort((a, b) => b.length - a.length)
  .join("|");

/** A quantity as people say it: `2`, `1.5`, `two`, `an`, `half an`, `a couple of`. */
const QTY = String.raw`(\d+(?:\.\d+)?|${WORD_ALTERNATIVES}|half an?|half|an?|a couple of|a couple|couple of)`;
const UNIT = String.raw`(hours?|hrs?|minutes?|mins?)\b`;

const quantity = (spoken: string): number | undefined => {
  const q = spoken.toLowerCase().trim();
  if (/^\d/.test(q)) return Number(q);
  if (q === "a" || q === "an") return 1;
  if (q.startsWith("half")) return 0.5;
  if (q.includes("couple")) return 2;
  return NUMBER_WORDS[q];
};

const minutesOf = (qty: string, unit: string): number | undefined => {
  const n = quantity(qty);
  if (n === undefined) return undefined;
  return /^h/i.test(unit) ? Math.round(n * 60) : Math.round(n);
};

interface Span {
  readonly start: number;
  readonly end: number;
  readonly minutes: number;
}

/**
 * **"How far will you go", in minutes — and the sentence with that part taken
 * out**, so the hours the day lasts are never read from it.
 *
 * ```
 * "I'll drive two hours for something special"     120, "I'll  for something special"
 * "Within 30 minutes of Kelowna"                    30,  "  of Kelowna"
 * "an adventure within 30 minutes"                  30
 * "a 45 minute drive"  ·  "an hour away"            45 · 60
 * ```
 *
 * "home within 2 hours" is a deadline, not a drive, and is left alone.
 */
export function travelIn(text: string): {
  readonly minutes?: number;
  readonly rest: string;
} {
  const spans: Span[] = [];
  const add = (pattern: RegExp, qtyAt: number, unitAt: number) => {
    for (const m of text.matchAll(pattern)) {
      const minutes = minutesOf(m[qtyAt] ?? "", m[unitAt] ?? "");
      if (minutes === undefined || minutes <= 0 || m.index === undefined)
        continue;
      spans.push({
        start: m.index,
        end: m.index + m[0].length,
        minutes,
      });
    }
  };

  // "drive two hours", "willing to travel up to an hour", "go as far as 90 minutes"
  add(
    new RegExp(
      String.raw`\b(?:drive|driving|travel(?:l?ing)?|commut(?:e|ing)|go|going|ride|riding)\s+(?:for\s+|up to\s+|about\s+|around\s+|maybe\s+|as much as\s+|as far as\s+|at most\s+|no more than\s+|a max of\s+)?${QTY}\s*${UNIT}`,
      "g",
    ),
    1,
    2,
  );
  // "within 30 minutes (of Kelowna)" — unless it is a deadline for being home.
  for (const m of text.matchAll(
    new RegExp(
      String.raw`\bwithin\s+(?:a\s+|an\s+)?${QTY}\s*${UNIT}(?:\s+(?:drive|away|of|from|by car|out))?`,
      "g",
    ),
  )) {
    const before = text.slice(Math.max(0, (m.index ?? 0) - 18), m.index);
    if (/\b(?:home|back|done|finish(?:ed)?|finished|over)\b/.test(before))
      continue;
    const minutes = minutesOf(m[1] ?? "", m[2] ?? "");
    if (minutes === undefined || minutes <= 0 || m.index === undefined)
      continue;
    spans.push({ start: m.index, end: m.index + m[0].length, minutes });
  }
  // "up to / under / less than 40 minutes away|of|from|drive"
  add(
    new RegExp(
      String.raw`\b(?:up to|under|less than|no more than|at most)\s+${QTY}\s*${UNIT}\s+(?:of driving|drive|away|of|from|by car)`,
      "g",
    ),
    1,
    2,
  );
  // "a 45 minute drive", "an hour away", "two hours from Kelowna", "30 min drive"
  add(
    new RegExp(
      String.raw`\b${QTY}[-\s]*${UNIT}\s+(?:of driving|drive|driving|away|by car|trip|from (?:here|home|town|the city))`,
      "g",
    ),
    1,
    2,
  );
  // "an hour and a half away"
  for (const m of text.matchAll(
    /\ban? hour and a half\s+(?:of driving|drive|away|by car)/g,
  )) {
    if (m.index !== undefined)
      spans.push({ start: m.index, end: m.index + m[0].length, minutes: 90 });
  }

  if (spans.length === 0) return { rest: text };
  spans.sort((a, b) => a.start - b.start || b.end - a.end);
  const first = spans[0]!;
  let rest = "";
  let at = 0;
  for (const span of spans) {
    if (span.start < at) continue;
    rest += text.slice(at, span.start) + " ";
    at = span.end;
  }
  rest += text.slice(at);
  return { minutes: first.minutes, rest };
}

/**
 * **"Free" that means *I am free*, taken out of the sentence.**
 *
 * `two hours free`, `free time`, `I'm free`, `a free afternoon` say when
 * somebody is available. What remains — `free activities`, `something free`,
 * `free things to do` — is about money.
 */
export function withoutAvailability(text: string): string {
  return text
    .replace(
      /\b(?:hours?|hrs?|minutes?|mins?|afternoons?|mornings?|evenings?|days?|weekends?|nights?)\s+(?:of\s+)?free\b/g,
      " ",
    )
    .replace(
      /\bfree\s+(?:time|afternoons?|mornings?|evenings?|days?|weekends?|hours?|tonight|today)\b/g,
      " ",
    )
    .replace(
      /\b(?:i'?m|we'?re|i am|we are|are|am|be|is)\s+(?:all\s+|totally\s+|completely\s+)?free\b/g,
      " ",
    );
}

/** Whether the person asked for things that cost nothing. */
export const asksForFree = (text: string): boolean =>
  /\bfree\b|\bno money\b|\bno cost\b|\bdon'?t want to pay\b/.test(
    withoutAvailability(text),
  );

/** How long the day is, in hours, from `text` with any travel already removed. */
export function hoursIn(text: string): number | undefined {
  const andAHalf = text.match(
    /\b(an?|one|two|three|four|five)\s+hours? and a half\b/,
  );
  if (andAHalf?.[1]) return (quantity(andAHalf[1]) ?? 0) + 0.5;
  if (/\bhalf an hour\b|\bhalf hour\b/.test(text)) return 0.5;
  const hours = text.match(new RegExp(String.raw`${QTY}\s*(?:hours?|hrs?)\b`));
  if (hours?.[1]) {
    const n = quantity(hours[1]);
    if (n !== undefined && n > 0) return n;
  }
  const minutes = text.match(
    new RegExp(String.raw`(\d+)\s*(?:minutes?|mins?)\b`),
  );
  if (minutes?.[1]) return Math.round((Number(minutes[1]) / 60) * 4) / 4;
  return undefined;
}

export type PartOfDay = "morning" | "afternoon" | "evening";

/** `tonight`, `this afternoon`, `this morning`. */
export function partOfDayIn(text: string): PartOfDay | undefined {
  if (/\btonight\b|\bthis evening\b|\bin the evening\b|\bevening\b/.test(text))
    return "evening";
  if (/\bthis afternoon\b|\bin the afternoon\b|\bafternoon\b/.test(text))
    return "afternoon";
  if (/\bthis morning\b|\bin the morning\b|\bmorning\b/.test(text))
    return "morning";
  return undefined;
}

/** When each part of the day starts, as a person plans one. */
export const PART_OF_DAY_START: Readonly<Record<PartOfDay, number>> = {
  morning: 9 * 60,
  afternoon: 13 * 60,
  evening: 18 * 60,
};

// ── Where ───────────────────────────────────────────────────────────────

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * **A town the person named.** The longest name wins, so "West Kelowna" is
 * not read as "Kelowna". Nothing is inferred from anything but the name.
 */
export function townIn(text: string): DiscoveryTown | undefined {
  const lower = text.toLowerCase();
  const named = DISCOVERY_TOWNS.map((t) => ({
    town: t,
    bare: t.name.replace(/,\s*BC$/i, "").toLowerCase(),
  }))
    .filter(({ bare }) => new RegExp(`\\b${escape(bare)}\\b`).test(lower))
    .sort((a, b) => b.bare.length - a.bare.length);
  return named[0]?.town;
}

/**
 * **"Let's do Kelowna instead."** In a revision, naming a town moves where
 * the day starts — unless the sentence is about a stop ("swap in the
 * Kelowna museum").
 */
export function townChangeIn(said: string): DiscoveryTown | undefined {
  const text = said.toLowerCase();
  if (/\b(?:swap|replace|remove|drop|cut|delete|add)\b/.test(text))
    return undefined;
  return townIn(text);
}

/** The town nearest a point, if it is within `maxKm` — never beyond. */
export function nearestTown(
  point: { readonly latitude: number; readonly longitude: number },
  distance: (
    a: { latitude: number; longitude: number },
    b: { latitude: number; longitude: number },
  ) => number,
  maxKm = 40,
): { readonly town: DiscoveryTown; readonly km: number } | undefined {
  let best: { town: DiscoveryTown; km: number } | undefined;
  for (const town of DISCOVERY_TOWNS) {
    const km = distance(point, town);
    if (!best || km < best.km) best = { town, km };
  }
  return best && best.km <= maxKm ? best : undefined;
}

// ── Who ─────────────────────────────────────────────────────────────────

/**
 * **The youngest child's age, where a number was said.** "Youngest is 6",
 * "she's 6", "aged 6", "6 years old", "the kids are 6 and 9" (→ 6). "A kid"
 * is not an age, and none is guessed.
 */
const AGE_WORDS: Readonly<Record<string, number>> = {
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
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
};

export function ageIn(spoken: string): number | undefined {
  const text = spoken.replace(
    new RegExp(
      `\\b(${Object.keys(AGE_WORDS).join("|")})(?=[-\\s]*(?:years?|yrs?|yo)\\b|\\s*(?:,|and|&|$|\\.))`,
      "g",
    ),
    (w) => String(AGE_WORDS[w]),
  );
  const found: number[] = [];
  const push = (raw: string | undefined) => {
    const n = Number(raw);
    if (Number.isInteger(n) && n >= 0 && n <= 17) found.push(n);
  };
  for (const m of text.matchAll(
    /\b(\d{1,2})[-\s]?(?:years?|yrs?)[-\s]?old\b|\b(\d{1,2})\s?yo\b|\baged?\s+(\d{1,2})\b/g,
  ))
    push(m[1] ?? m[2] ?? m[3]);
  for (const m of text.matchAll(
    /\b(?:youngest|baby|little one|smallest|kid|child|son|daughter|he|she|they)(?:\s+is|\s+are|'s|’s)\s+(\d{1,2})\b/g,
  ))
    push(m[1]);
  for (const m of text.matchAll(
    /\b(?:kids|children|boys|girls|twins|grandkids)\s+are\s+((?:\d{1,2}(?:\s*(?:,|and|&)\s*)?)+)/g,
  )) {
    for (const n of (m[1] ?? "").match(/\d{1,2}/g) ?? []) push(n);
  }
  return found.length > 0 ? Math.min(...found) : undefined;
}

// ── What ────────────────────────────────────────────────────────────────

/**
 * An activity somebody can ask for, how it is said, and what an Atlas
 * subject has to *state* to count as offering it.
 *
 * `say` is read against the sentence; `terms` against what Atlas states
 * (verbs, features, subtype, title). Both are whole-word, stemmed, and
 * deliberately plain — if a place does not say it, Passport does not claim
 * it. Multi-word terms match as a phrase.
 */
interface Activity {
  readonly label: string;
  readonly say: RegExp;
  readonly terms: readonly string[];
  /** Stated phrases that look like it and are not — "water skiing" is not skiing. */
  readonly notThese?: readonly string[];
}

const activity = (
  label: string,
  say: RegExp,
  terms: readonly string[] = [label],
  notThese?: readonly string[],
): Activity => ({
  label,
  say,
  terms,
  ...(notThese ? { notThese } : {}),
});

/**
 * Ordered: a longer phrase is read before the shorter word inside it, and a
 * match is removed from the sentence so "jet ski" is not also "ski".
 */
const ACTIVITIES: readonly Activity[] = [
  activity("scuba diving", /\bscuba(?:[\s-]+div(?:e|es|ing))?\b/, ["scuba"]),
  activity("skydiving", /\bsky[\s-]?div(?:e|es|ing)\b/, [
    "skydive",
    "skydiving",
  ]),
  activity("paragliding", /\bparaglid(?:e|er|ing)\b/, [
    "paragliding",
    "paraglide",
  ]),
  activity("jet boating", /\bjet[\s-]?(?:boat|boating|ski|skiing)\b/, [
    "jet boat",
    "jet boating",
    "jet ski",
  ]),
  activity("snorkelling", /\bsnorkel(?:l?ing)?\b/, ["snorkel"]),
  activity("bungee jumping", /\bbungee(?:[\s-]+jump(?:ing)?)?\b/, ["bungee"]),
  activity("zip-lining", /\bzip[\s-]?lin(?:e|es|ing)\b|\bziplin/, [
    "zipline",
    "zip line",
    "zip lining",
  ]),
  activity("rafting", /\b(?:white[\s-]?water\s+)?raft(?:ing)?\b/, ["raft"]),
  activity("surfing", /\bsurf(?:ing)?\b/, ["surf"]),
  activity("sharks", /\bsharks?\b/, ["shark"]),
  activity("whale watching", /\bwhales?(?:[\s-]+watching)?\b/, ["whale"]),
  activity("dolphins", /\bdolphins?\b/, ["dolphin"]),
  activity("snowboarding", /\bsnowboard(?:ing|s)?\b/, ["snowboard"]),
  activity("tobogganing", /\btoboggan(?:ing)?\b|\bsledd?ing\b/, [
    "toboggan",
    "sled",
    "tubing",
  ]),
  activity("dog sledding", /\bdog[\s-]?sled(?:d?ing)?\b/, ["dog sled"]),
  activity(
    "skiing",
    /\bski(?:ing|s|er|ers)?\b|\bdownhill\b|\bski resort\b/,
    ["ski", "skiing", "snowboard", "downhill"],
    ["water ski", "waterski", "water skiing", "waterskiing", "jet ski"],
  ),
  activity("snowshoeing", /\bsnowshoe(?:ing|s)?\b/, ["snowshoe"]),
  activity("mini golf", /\bmini[\s-]?golf\b|\bputt[\s-]?putt\b/, [
    "mini golf",
    "minigolf",
    "putt",
  ]),
  activity("golf", /\bgolf(?:ing)?\b/, ["golf"]),
  activity("bowling", /\bbowling\b/, ["bowl", "bowling"]),
  activity("axe throwing", /\baxe[\s-]?throwing\b/, ["axe"]),
  activity("escape room", /\bescape[\s-]?rooms?\b/, ["escape room", "escape"]),
  activity("go-karting", /\bgo[\s-]?kart(?:s|ing)?\b/, ["kart", "karting"]),
  activity("archery", /\barchery\b/, ["archery"]),
  activity("paintball", /\bpaintball\b|\blaser tag\b/, [
    "paintball",
    "laser tag",
  ]),
  activity("tennis", /\btennis\b|\bpickleball\b/, ["tennis", "pickleball"]),
  activity(
    "horseback riding",
    /\bhorse(?:back)?[\s-]?(?:rid(?:e|es|ing))\b|\bhorses\b/,
    ["horse", "horseback", "equestrian", "stable"],
  ),
  activity("sailing", /\bsail(?:ing)?\b/, ["sail", "sailing"]),
  activity("boating", /\bboat(?:ing)?\b|\bcruise\b/, [
    "boat",
    "boating",
    "marina",
    "cruise",
  ]),
  activity("hot springs", /\bhot[\s-]?springs?\b|\bsoaking pools?\b/, [
    "hot spring",
    "hot springs",
    "hot pool",
  ]),
  activity("spa", /\bspa\b|\bmassage\b/, ["spa", "massage"]),
  activity("yoga", /\byoga\b/, ["yoga"]),
  activity("casino", /\bcasino\b/, ["casino"]),
  activity("cinema", /\bmovies?\b|\bcinema\b|\bfilm\b/, [
    "cinema",
    "movie",
    "film",
  ]),
  activity("theatre", /\btheat(?:re|er)s?\b|\bplay\b(?= tonight)/, [
    "theatre",
    "theater",
  ]),
  activity("concert", /\bconcerts?\b|\blive music\b|\bgig\b/, [
    "concert",
    "live music",
  ]),
  activity("comedy", /\bcomedy\b|\bstand[\s-]?up\b/, ["comedy"]),
  activity("karaoke", /\bkaraoke\b/, ["karaoke"]),
  activity("dancing", /\bdancing\b|\bnightclub\b|\bnightlife\b/, [
    "dance",
    "dancing",
    "nightclub",
    "nightlife",
  ]),
  activity("zoo", /\bzoos?\b/, ["zoo"]),
  activity("aquarium", /\baquariums?\b/, ["aquarium"]),
  activity("camping", /\bcamp(?:ing)?\b/, ["camp", "camping", "campground"]),
  activity("shopping", /\bshopping\b|\bmall\b|\bboutiques?\b/, [
    "shop",
    "shopping",
    "mall",
    "boutique",
  ]),
  activity("hockey", /\bhockey\b/, ["hockey"]),
  activity("bouldering", /\bboulder(?:ing)?\b/, ["boulder", "climbing"]),

  // The words the builder has always listened for, with what makes a place
  // credible for each.
  activity("swimming", /\bswim(?:ming)?\b/, [
    "swim",
    "swimming",
    "beach",
    "pool",
    "splash",
    "spray",
  ]),
  activity("hiking", /\bhik(?:e|es|ing)\b/, [
    "hike",
    "hiking",
    "trail",
    "trek",
  ]),
  activity("walking", /\bwalk(?:ing|s)?\b|\bstroll(?:ing)?\b/, [
    "walk",
    "walking",
    "stroll",
    "trail",
    "path",
  ]),
  activity("cycling", /\bcycl(?:e|es|ing)\b/, [
    "cycle",
    "cycling",
    "bike",
    "biking",
    "bicycle",
  ]),
  activity("biking", /\bbik(?:e|es|ing)\b/, [
    "bike",
    "biking",
    "bicycle",
    "cycling",
    "cycle",
  ]),
  activity("fishing", /\bfish(?:ing)?\b/, ["fish", "fishing"]),
  activity("skating", /\bskat(?:e|es|ing)\b/, ["skate", "skating", "rink"]),
  activity("paddling", /\bpaddl(?:e|es|ing)\b/, [
    "paddle",
    "paddling",
    "paddleboard",
    "kayak",
    "canoe",
  ]),
  activity("kayaking", /\bkayak(?:s|ing)?\b/, ["kayak", "kayaking", "paddle"]),
  activity("canoeing", /\bcano(?:e|es|eing)\b/, [
    "canoe",
    "canoeing",
    "paddle",
  ]),
  activity("playground", /\bplaygrounds?\b/, [
    "playground",
    "tot lot",
    "splash",
    "spray",
  ]),
  activity("picnic", /\bpicnic(?:s|king)?\b/, ["picnic"]),
  activity("birdwatching", /\bbird[\s-]?watching\b|\bbirding\b/, [
    "bird",
    "birding",
    "birdwatching",
    "wildlife",
  ]),
  activity("wildlife", /\bwildlife\b/, [
    "wildlife",
    "bird",
    "animal",
    "nature",
  ]),
  activity("animals", /\banimals?\b/, [
    "animal",
    "wildlife",
    "zoo",
    "farm",
    "aquarium",
  ]),
  activity("farm", /\bfarms?\b/, ["farm", "orchard", "ranch"]),
  activity("pumpkin", /\bpumpkins?\b/, ["pumpkin"]),
  activity("museum", /\bmuseums?\b/, ["museum"]),
  activity("art", /\bart\b/, ["art", "gallery"]),
  activity("music", /\bmusic\b/, ["music", "concert"]),
  activity("coffee", /\bcoffee\b/, ["coffee", "cafe", "roaster"]),
  activity("food", /\bfood\b/, [
    "restaurant",
    "cafe",
    "food",
    "dining",
    "bakery",
    "bistro",
    "pub",
    "grill",
    "kitchen",
  ]),
  activity("beach", /\bbeach(?:es)?\b/, ["beach"]),
  activity("trail", /\btrails?\b/, ["trail"]),
  activity("park", /\bparks?\b/, ["park"]),
  activity("climbing", /\bclimb(?:ing)?\b/, ["climb", "climbing", "boulder"]),
  activity("books", /\bbooks?\b/, ["book", "library"]),
  activity("history", /\bhistory\b|\bhistoric(?:al)?\b/, [
    "history",
    "historic",
    "heritage",
    "museum",
  ]),
  activity("lunch", /\blunch\b/, [
    "restaurant",
    "cafe",
    "bistro",
    "bakery",
    "pub",
    "grill",
    "food",
    "lunch",
  ]),
  activity("restaurant", /\brestaurants?\b/, ["restaurant", "bistro", "grill"]),
  activity("cafe", /\bcafes?\b|\bcafés?\b/, ["cafe", "coffee"]),
  activity("brewery", /\bbreweries\b|\bbrewery\b|\bbeer\b/, [
    "brewery",
    "brewing",
    "brew",
    "beer",
    "taproom",
  ]),
  activity("winery", /\bwineries\b|\bwinery\b|\bwine\b/, [
    "winery",
    "wine",
    "vineyard",
  ]),
  activity("market", /\bmarkets?\b/, ["market"]),
  activity("garden", /\bgardens?\b/, ["garden"]),
  activity("viewpoint", /\bviewpoints?\b|\blookouts?\b/, [
    "viewpoint",
    "lookout",
    "vista",
    "summit",
  ]),
  activity("waterfall", /\bwaterfalls?\b/, ["waterfall", "falls"]),
  activity("lake", /\blakes?\b/, ["lake"]),
  activity("science", /\bscience\b/, ["science", "discovery"]),
];

/** The labels, for anything that needs to know what can be asked for. */
export const ACTIVITY_LABELS: readonly string[] = ACTIVITIES.map(
  (a) => a.label,
);

/**
 * **What somebody asked to do.** Whole words, in the order said; a phrase
 * wins over the word inside it. Anything outside this list is not recognised
 * — which is a limit of a deterministic reading, and is named as one in the
 * release notes rather than papered over.
 */
export function activitiesIn(text: string): string[] {
  let rest = text.toLowerCase();
  const found: { at: number; label: string }[] = [];
  for (const { label, say } of ACTIVITIES) {
    const m = new RegExp(say.source, "i").exec(rest);
    if (!m) continue;
    found.push({ at: m.index, label });
    rest =
      rest.slice(0, m.index) +
      " ".repeat(m[0].length) +
      rest.slice(m.index + m[0].length);
  }
  return found.sort((a, b) => a.at - b.at).map((f) => f.label);
}

/** A word cut back to what Atlas's own words for it share with it. */
export const stem = (word: string): string => {
  let w = word.toLowerCase().trim();
  if (w.length > 5 && w.endsWith("ing")) {
    w = w.slice(0, -3);
    if (/([b-df-hj-np-tv-z])\1$/.test(w)) w = w.slice(0, -1);
  }
  if (w.length > 3 && /[es]$/.test(w)) w = w.slice(0, -1);
  return w;
};

const norm = (word: string): string =>
  stem(word.toLowerCase().replace(/ies$/, "y").replace(/é/g, "e"));

const phrase = (text: string): string =>
  ` ${(text.toLowerCase().match(/[a-zé]+/g) ?? []).map(norm).join(" ")} `;

const STATED = new WeakMap<Experience, string>();

/** Everything an Atlas subject states about itself, as one stemmed phrase. */
function statedText(experience: Experience): string {
  const cached = STATED.get(experience);
  if (cached) return cached;
  const text = phrase(
    [
      ...(experience.knowledge?.affordances ?? []).map((a) => a.name ?? ""),
      ...(experience.knowledge?.features ?? []),
      experience.subtype ?? "",
      experience.title,
    ].join(" . "),
  );
  STATED.set(experience, text);
  return text;
}

const termsFor = (label: string): readonly string[] =>
  ACTIVITIES.find((a) => a.label === label)?.terms ?? [label];

/**
 * **Whether a subject states that it offers this.** Nothing but its own
 * stated words count: not the category it sits in, not a neighbour's
 * description, not what a place of that kind "usually" has.
 */
export function offers(experience: Experience, label: string): boolean {
  const entry = ACTIVITIES.find((a) => a.label === label);
  let text = statedText(experience);
  for (const not of entry?.notThese ?? [])
    text = text.split(phrase(not)).join(" ");
  return termsFor(label).some((term) => text.includes(phrase(term)));
}

/**
 * **What Atlas does not say.** Of the activities asked for, those no
 * eligible subject states it offers — and, where a starting point is known,
 * the nearest subject anywhere that does (it may be past the circle).
 */
export interface Unmet {
  readonly activity: string;
  /** The nearest subject that states it, however far, with km from the start. */
  readonly nearest?: { readonly title: string; readonly km: number };
  /**
   * Subjects that state it but have **no location in Atlas**, so nobody can
   * say whether they are near. Named, because "nothing near you" would be
   * false: something might be.
   */
  readonly unplaced?: readonly string[];
}

export function unmetIn(
  activities: readonly string[],
  eligible: readonly Experience[],
  everything: readonly Experience[],
  distance?: (e: Experience) => number | undefined,
): Unmet[] {
  const out: Unmet[] = [];
  for (const label of activities) {
    if (eligible.some((e) => offers(e, label))) continue;
    let nearest: { title: string; km: number } | undefined;
    const unplaced: string[] = [];
    if (distance) {
      for (const e of everything) {
        if (!offers(e, label)) continue;
        const km = distance(e);
        if (km === undefined) {
          if (!unplaced.includes(e.title)) unplaced.push(e.title);
          continue;
        }
        if (!nearest || km < nearest.km) nearest = { title: e.title, km };
      }
    }
    out.push({
      activity: label,
      ...(nearest
        ? { nearest: { ...nearest, km: Math.round(nearest.km) } }
        : {}),
      ...(unplaced.length > 0 ? { unplaced: unplaced.slice(0, 4) } : {}),
    });
  }
  return out;
}
