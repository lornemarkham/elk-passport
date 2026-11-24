import type { Experience } from "@/domain/experience/types";

/**
 * **What makes something a Christmas find — in Atlas's words, never ours.**
 *
 * Passport groups Christmas into seven things a family actually says
 * ("markets", "the lights", "see Santa") and a subject belongs to one only
 * where Atlas holds a word for it **in the subject's own evidence**: its name,
 * what Atlas says it is, its description, what you can do there, and the
 * organiser's own stated facts. The card then says which word, from where
 * (doctrine §5, ADR 005's "named in a person's words, evidenced by Atlas's").
 *
 * Deliberately **not** evidence:
 *
 * - a picture's caption or source — an illustrative category photo of a
 *   Christmas market says nothing about the café it decorates;
 * - holiday hours — "Closed on Christmas Day", "Open stat holidays except
 *   Christmas" and a shuttle's "Christmas Pass price" are about Christmas the
 *   date, not things to do for it;
 * - the word "holiday" alone, which is mostly hotels and statutory hours.
 *
 * Measured on Atlas's corpus of 2026-10-24 (5,469 candidates): the name
 * alone catches fewer than half; the organiser's stated facts and
 * Atlas's subtype carry the rest (`themes.eval.test.ts`).
 */

export type ThemeId =
  | "markets"
  | "lights"
  | "santa"
  | "festivals"
  | "shows"
  | "food"
  | "winter"
  | "newyear";

export interface ChristmasTheme {
  readonly id: ThemeId;
  /** What a person would call it. */
  readonly label: string;
  /** One line under the label. */
  readonly line: string;
  readonly emoji: string;
  /** The words, matched case-insensitively on whole words. */
  readonly words: RegExp;
  /**
   * **What the thing must be called to be one of these** (owner QA,
   * 2026-11-22: a performing-arts academy was listed under Holiday lights
   * because a class is called "Twinkle Stars"). A theme whose only evidence
   * is a mention — in a description or the organiser's facts — counts only
   * where the title or Atlas's listed type says it too: a hockey game whose
   * crowd will "light up" the arena is not a lights display.
   */
  readonly called: RegExp;
  /**
   * Christmas itself, or the season around it. A skating rink is a lovely
   * part of a Christmas day and is still not a Christmas thing — the card
   * says "winter fun", never "Christmas".
   */
  readonly seasonal?: true;
}

export const THEMES: readonly ChristmasTheme[] = [
  {
    id: "markets",
    label: "Christmas markets",
    line: "Wooden stalls, makers and something warm to hold.",
    emoji: "🎪",
    called:
      /\b(markets?|march[ée]s?|fairs?|bazaars?|craft sales?|artisans?|makers|christkindl\w*)\b/i,
    words:
      /\b(christmas markets?|holiday markets?|winter markets?|christkindl\w*|sugar plum fair|artisans?'? christmas|christmas craft (fair|sale)s?)\b/i,
  },
  {
    id: "lights",
    label: "Holiday lights",
    line: "Walk-through lights, light-ups and twinkling trails.",
    emoji: "✨",
    called:
      /\b(?!(?:spot|high|de|flash|sun|day|moon|head|stop|traffic|gas)light)\w*lights?\b|\blighting\b|illumin\w*|\blight[- ]?ups?\b|luminar\w*|\bglow\w*|twinkl\w*|bright nights/i,
    words:
      /\b(canyon lights|holiday lights?|christmas lights?|light[- ]?ups?|lights? (festival|display|walk|trail)s?|festival of lights|twinkl\w+|bright nights|illuminations?)\b/i,
  },
  {
    id: "santa",
    label: "Santa & the little ones",
    line: "Santa, his workshop, his reindeer and the kids who believe.",
    emoji: "🎅",
    called:
      /\b(santa|claus|north pole|reindeer|elf|elves|gingerbread|st\.? nick)\b/i,
    words:
      /\b(santa('s)?|north pole|reindeer|elves|letters to santa|storytime with santa|gingerbread houses?)\b/i,
  },
  {
    id: "festivals",
    label: "Winter festivals",
    line: "Villages, tree lightings, fireworks and Christmas Eve celebrations.",
    emoji: "🎄",
    called:
      /\b(festivals?|fest|village|celebrations?|tree lighting|carnival|parades?|christmas eve|no[eë]l|swissmas|light[- ]?ups?|fireworks?|trains?)\b/i,
    // A lit holiday train stopping in town (the CPKC Holiday Train, owner
    // brief M1064) is the season's travelling festival.
    words:
      /\b(holiday trains?|christmas trains?|christmas eve festival|christmas festival|holiday (celebration|kick-?off|festival)|festive village|tree lighting|winter ?(fest|festival|carnival)|swissmas|christmas (celebration|party)|fireworks?|boxing day)\b/i,
  },
  {
    id: "shows",
    label: "Shows & traditions",
    line: "The Nutcracker, carols, a Christmas Carol, a sleigh-ride show.",
    emoji: "🎭",
    called:
      /\b(shows?|concerts?|nutcracker|carols?|messiah|choirs?|theatre|theater|ballet|pageant|performances?|symphony|orchestra|singers|musical|panto\w*|tenors|presentation)\b/i,
    words:
      /\b(nutcracker|a christmas carol|carol(l)?ing|carols|messiah|sleigh ride show|winter sleigh ride|rudolph|holiday (concert|show)s?|christmas (concert|show|pageant|crafting|craft)s?|wreath[- ]making)\b/i,
  },
  {
    id: "food",
    label: "Festive food",
    line: "Christmas dinners, egg nog, gingerbread and festive bars.",
    emoji: "🍪",
    called:
      /\b(dinners?|brunch|lunch|feast|tea|cookies?|baking|menus?|bar|nog|gingerbread|cider|wine|treats|yule log|tourti\w+|chocolate|caf[ée]s?|coffee|restaurants?|bistro|bakery|bakeries|pub|winery|brewery|eatery|kitchen|dining|tasting)\b/i,
    words:
      /\b(christmas (eve )?(dinner|brunch|lunch|feast|cookies?|baking|menu)s?|christmas dinner to go|holiday (meal|menu|dinner)s?|egg ?nog|gingerbread|mulled (wine|cider)|festive (d[ée]cor|menu|favourites|treats)|winter wonder bar|yule log|tourti[eè]re)\b/i,
  },
  {
    id: "winter",
    label: "Winter fun",
    line: "Skating, sleigh rides and sledding — the season around it.",
    emoji: "⛸️",
    called: /\b(skat\w*|rinks?|sleigh\w*|sled\w*|tobogg\w*|snow\w*)\b/i,
    words:
      /\b(ice skating|skating rinks?|ice rinks?|outdoor rinks?|public skat(e|ing)|skating|sleigh rides?|sledding|tobogg\w+)\b/i,
    seasonal: true,
  },
  {
    // Owner brief M1053 "Holiday Season 2026": New Year's Eve is a
    // category of its own, and New Year's Day with it. Only an event held
    // in the season counts (`inSeason`), so a Lunar New Year festival in
    // February is not; "Happy New Year" on a menu is a greeting, not an event.
    id: "newyear",
    label: "New Year's Eve",
    line: "Countdowns, fireworks, a party — and New Year's Day after.",
    emoji: "🎆",
    called:
      /\b(new year['’]?s?|nye|countdown|ring in|polar bear|hogmanay|first night|levee|lev[ée]e)\b/i,
    words:
      /\b(new year['’]?s['’]? (eve|day)|new year['’]?s? (celebration|party|bash|concert|gala|countdown|levee|walk|swim|dip|plunge|skate|dance|dinner)|nye|ring in (the new year|20\d\d)|countdown to (midnight|20\d\d|the new year)|family countdown|noon countdown|first night|hogmanay|polar bear (swim|dip|plunge))\b/i,
  },
];

/** A new year that is not the one on December 31. */
const OTHER_NEW_YEAR =
  /\b(lunar|chinese|persian|jewish|rosh|vietnamese|tet|nowruz)\b[^.;]{0,20}new year/i;

/**
 * Christmas the date, not a thing to do — removed from a sentence before it
 * is read. Whole clauses, so "Closed on Christmas Day" goes and "Christmas
 * Eve Dinner" in the same record stays.
 */
const NOT_EVIDENCE: readonly RegExp[] = [
  /\b(closed|open|opening|except( for)?|hours?|reduced hours)\b[^.;:]{0,40}\b(christmas|xmas)( (day|eve))?/gi,
  /\b(christmas|xmas)( (day|eve))?\b[^.;:]{0,25}\b(closed|hours|open)\b/gi,
  /\bchristmas (and|&) new year'?s?( day)?\b/gi,
  /\bholiday inn\b/gi,
  /\bholiday hours?\b[^.;:]*/gi,
  /\bchristmas pass\b/gi,
  /\bskate ?(parks?|plazas?|boards?|boarding)\b/gi,
  /\b(roller|inline) skat\w*/gi,
];

/** Practical facts that tell a subject's story rather than what it offers. */
const BACKSTORY =
  /\b(awards?|histor\w*|founded|story|background|about us|camps?)\b/i;

/** Another season's occasion, whatever its menu says. */
const OTHER_SEASON = /\b(hallowe+n\w*|halloweenie|thanksgiving|easter)\b/i;

/**
 * The fields a weak signal may come from. The season around Christmas (a
 * rink) and a bare "Christmas" count only where Atlas says what the thing
 * *is* or *offers* — a ski school's "Christmas Break Camp" is a ski camp.
 */
const STRONG_FIELDS: ReadonlySet<EvidenceField> = new Set([
  "name",
  "subtype",
  "activity",
  "description",
]);

/** Where Atlas says what a thing *is*, *is called* or *offers*. */
const IDENTITY_FIELDS: ReadonlySet<EvidenceField> = new Set([
  "name",
  "subtype",
  "activity",
]);

/** Not a lights display, whatever it sells or makes (the planner's own rule). */
export const NOT_A_DISPLAY =
  /\b(yoga|class|classes|workshop|sale|paint|fundraiser|craft)\b/i;

/** Any Christmas word, after the date-not-thing clauses are gone. */
const CHRISTMAS = /\b(christmas|xmas|festive|yuletide|santa)\b/i;

/**
 * **The holidays, said by an event held in them** (owner brief M1046: the
 * Vernon and Silver Star events Atlas published in mission 1042). "Stars on
 * Ice – 2026 Holiday Tour", "12 Days of Holidays", "a holiday rail jam",
 * "kick off the holiday season", "New Years Eve Celebration" never say
 * "Christmas", and are Christmas-season outings all the same. Only an event
 * whose own start falls in the season (`IN_SEASON`) is read this way, so a
 * summer "holiday camp" or a Holiday Inn is not; the name may say it plainly,
 * the description only as one of these phrases.
 */
const HOLIDAYS_NAMED = /\b(holidays?|new year['’]?s eve)\b/i;
const HOLIDAYS_SAID =
  /\b(the holiday season|the holidays|holiday spirit|holiday cheer|holiday (rail jam|tour|show|concert|party|market|celebration)s?)\b/i;
const NOT_THE_HOLIDAYS = [
  /\bholiday (inn|park|rv)\b/gi,
  /\b(closed|open|hours?)\b[^.;:]{0,30}\b(the )?holidays?\b/gi,
];

/**
 * New Year's is the night it is, not a word on a menu: an event counts only
 * when it is held in the season, anything else only where its own name or
 * listed type says it — and never a Lunar or other new year.
 */
function newYearsOwn(experience: Experience, evidence: Evidence): boolean {
  if (OTHER_NEW_YEAR.test(`${experience.title} ${evidence.quote}`))
    return false;
  if (experience.kind === "Event") return inSeason(experience);
  return evidence.field === "name" || evidence.field === "subtype";
}

/** November to Epiphany, by the event's own start date. */
function inSeason(experience: Experience): boolean {
  if (experience.kind !== "Event" || !experience.startTime) return false;
  const [, month, day] = experience.startTime
    .slice(0, 10)
    .split("-")
    .map(Number);
  return month === 11 || month === 12 || (month === 1 && day! <= 6);
}

function holidaysWord(experience: Experience): Evidence | undefined {
  if (!inSeason(experience)) return undefined;
  const plain = (text: string) =>
    NOT_THE_HOLIDAYS.reduce((t, rule) => t.replace(rule, " "), clean(text));
  const said: [EvidenceField, string | undefined, RegExp][] = [
    ["name", experience.title, HOLIDAYS_NAMED],
    ["subtype", experience.subtype, HOLIDAYS_NAMED],
    ["description", experience.description, HOLIDAYS_SAID],
  ];
  for (const [field, text, words] of said) {
    if (!text) continue;
    const match = words.exec(plain(text));
    if (match)
      return {
        field,
        word: match[0],
        quote: quoteAround(
          text,
          Math.max(0, text.indexOf(match[0])),
          match[0].length,
        ),
      };
  }
  return undefined;
}

export type EvidenceField =
  "name" | "subtype" | "description" | "activity" | "organiser";

/** One reason something is here, as the card says it. */
export interface Evidence {
  readonly field: EvidenceField;
  /** The words Atlas holds that matched, as Atlas holds them. */
  readonly word: string;
  /** The sentence it came from, trimmed — never rewritten. */
  readonly quote: string;
}

export interface ChristmasReading {
  /** Every theme the evidence supports, strongest first. */
  readonly themes: readonly ThemeId[];
  /** Christmas itself (not only winter fun). */
  readonly christmas: boolean;
  /** The first reason, for the card; the rest for its detail. */
  readonly evidence: readonly Evidence[];
}

const FIELD_ORDER: Readonly<Record<EvidenceField, number>> = {
  name: 0,
  subtype: 1,
  activity: 2,
  organiser: 3,
  description: 4,
};

/** Every sentence of the subject's own evidence, labelled by where it came from. */
function sentencesOf(
  experience: Experience,
): { field: EvidenceField; text: string }[] {
  const out: { field: EvidenceField; text: string }[] = [];
  const push = (field: EvidenceField, text: string | undefined) => {
    const t = text?.trim();
    if (t) out.push({ field, text: t });
  };
  push("name", experience.title);
  for (const alias of experience.aliases ?? []) push("name", alias);
  push("subtype", experience.subtype);
  // Atlas's own verdict on a description that only restates the title.
  if (experience.knowledge?.descriptionAddsKnowledge !== false)
    push("description", experience.description);
  for (const a of experience.knowledge?.affordances ?? [])
    push("activity", a.name);
  for (const p of experience.knowledge?.practical ?? [])
    // An award or a history line mentions an occasion; it isn't one here.
    if (!BACKSTORY.test(p.label)) push("organiser", `${p.label}: ${p.value}`);
  for (const s of experience.suitability?.statements ?? [])
    push("organiser", s.text);
  for (const s of experience.environment?.statements ?? [])
    push("organiser", s.text);
  push("organiser", experience.visitDuration?.text);
  return out;
}

function clean(text: string): string {
  return NOT_EVIDENCE.reduce((t, rule) => t.replace(rule, " "), text);
}

function quoteAround(text: string, index: number, length: number): string {
  if (text.length <= 140) return text;
  const from = Math.max(0, index - 50);
  const to = Math.min(text.length, index + length + 70);
  return `${from > 0 ? "…" : ""}${text.slice(from, to).trim()}${to < text.length ? "…" : ""}`;
}

/**
 * **Whether, and why, this is a Christmas find.** `null` when Atlas holds no
 * Christmas or winter word for it — which is most of the corpus, and the
 * right answer.
 */
export function readChristmas(experience: Experience): ChristmasReading | null {
  if (OTHER_SEASON.test(experience.title)) return null;
  const found = new Map<ThemeId, Evidence>();
  let christmasWord: Evidence | undefined;
  const sentences = sentencesOf(experience).sort(
    (a, b) => FIELD_ORDER[a.field] - FIELD_ORDER[b.field],
  );
  for (const { field, text } of sentences) {
    const usable = clean(text);
    for (const theme of THEMES) {
      if (found.has(theme.id)) continue;
      if (theme.seasonal && !STRONG_FIELDS.has(field)) continue;
      const match = theme.words.exec(usable);
      if (match)
        found.set(theme.id, {
          field,
          word: match[0],
          quote: quoteAround(text, match.index, match[0].length),
        });
    }
    if (!christmasWord && STRONG_FIELDS.has(field)) {
      const match = CHRISTMAS.exec(usable);
      if (match)
        christmasWord = {
          field,
          word: match[0],
          quote: quoteAround(text, match.index, match[0].length),
        };
    }
  }
  christmasWord ??= holidaysWord(experience);
  // A theme the thing is only *mentioned* with is not what it is: it
  // counts where Atlas names, lists or offers it so, or where the title or
  // listed type is called it too (`called`). A display is never a sale,
  // a class or a fundraiser that happens to sell or make lights.
  const calledAs = [
    experience.title,
    ...(experience.aliases ?? []),
    experience.subtype ?? "",
  ].join(" · ");
  const themes = THEMES.filter((t) => {
    const evidence = found.get(t.id);
    if (!evidence) return false;
    if (t.id === "lights" && NOT_A_DISPLAY.test(experience.title)) return false;
    if (t.id === "newyear" && !newYearsOwn(experience, evidence)) return false;
    return IDENTITY_FIELDS.has(evidence.field) || t.called.test(calledAs);
  }).map((t) => t.id);
  if (themes.length === 0 && !christmasWord) return null;

  const christmas =
    Boolean(christmasWord) || themes.some((id) => !themeById(id).seasonal);
  const kept = themes.map((id) => found.get(id)!);
  const evidence = [
    ...kept.sort((a, b) => FIELD_ORDER[a.field] - FIELD_ORDER[b.field]),
    ...(christmasWord && !kept.length ? [christmasWord] : []),
  ];
  return { themes, christmas, evidence };
}

export function themeById(id: ThemeId): ChristmasTheme {
  return THEMES.find((t) => t.id === id)!;
}

export const isThemeId = (value: unknown): value is ThemeId =>
  THEMES.some((t) => t.id === value);

/** How the card says where its reason came from. */
export function evidenceLine(evidence: Evidence): string {
  switch (evidence.field) {
    case "name":
      return `It's in the name: “${evidence.word}”`;
    case "subtype":
      return `Listed as “${evidence.word}”`;
    case "activity":
      return `“${evidence.word}” is listed as something to do here`;
    case "description":
      return `Its description says “${evidence.word}”`;
    case "organiser":
      return `The organiser says: “${evidence.quote}”`;
  }
}
