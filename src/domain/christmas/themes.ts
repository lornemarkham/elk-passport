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
  "markets" | "lights" | "santa" | "festivals" | "shows" | "food" | "winter";

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
    words:
      /\b(christmas markets?|holiday markets?|winter markets?|christkindl\w*|sugar plum fair|artisans?'? christmas|christmas craft (fair|sale)s?)\b/i,
  },
  {
    id: "lights",
    label: "Holiday lights",
    line: "Walk-through lights, light-ups and twinkling trails.",
    emoji: "✨",
    words:
      /\b(canyon lights|holiday lights?|christmas lights?|light[- ]?ups?|lights? (festival|display|walk|trail)s?|festival of lights|twinkl\w+|bright nights|illuminations?)\b/i,
  },
  {
    id: "santa",
    label: "Santa & the little ones",
    line: "Santa, his workshop, his reindeer and the kids who believe.",
    emoji: "🎅",
    words:
      /\b(santa('s)?|north pole|reindeer|elves|letters to santa|storytime with santa|gingerbread houses?)\b/i,
  },
  {
    id: "festivals",
    label: "Winter festivals",
    line: "Villages, tree lightings and Christmas Eve celebrations.",
    emoji: "🎄",
    words:
      /\b(christmas eve festival|christmas festival|holiday (celebration|kick-?off|festival)|festive village|tree lighting|winter ?(fest|festival|carnival)|swissmas|christmas (celebration|party))\b/i,
  },
  {
    id: "shows",
    label: "Shows & traditions",
    line: "The Nutcracker, carols, a Christmas Carol, a sleigh-ride show.",
    emoji: "🎭",
    words:
      /\b(nutcracker|a christmas carol|carol(l)?ing|carols|messiah|sleigh ride show|winter sleigh ride|rudolph|holiday (concert|show)s?|christmas (concert|show|pageant|crafting|craft)s?|wreath[- ]making)\b/i,
  },
  {
    id: "food",
    label: "Festive food",
    line: "Christmas dinners, egg nog, gingerbread and festive bars.",
    emoji: "🍪",
    words:
      /\b(christmas (eve )?(dinner|brunch|lunch|feast|cookies?|baking|menu)s?|christmas dinner to go|holiday (meal|menu|dinner)s?|egg ?nog|gingerbread|mulled (wine|cider)|festive (d[ée]cor|menu|favourites|treats)|winter wonder bar|yule log|tourti[eè]re)\b/i,
  },
  {
    id: "winter",
    label: "Winter fun",
    line: "Skating, sleigh rides and sledding — the season around it.",
    emoji: "⛸️",
    words:
      /\b(ice skating|skating rinks?|ice rinks?|outdoor rinks?|public skat(e|ing)|skating|sleigh rides?|sledding|tobogg\w+)\b/i,
    seasonal: true,
  },
];

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

/** Any Christmas word, after the date-not-thing clauses are gone. */
const CHRISTMAS = /\b(christmas|xmas|festive|yuletide|santa)\b/i;

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
  if (found.size === 0 && !christmasWord) return null;

  const themes = THEMES.filter((t) => found.has(t.id)).map((t) => t.id);
  const christmas =
    Boolean(christmasWord) || themes.some((id) => !themeById(id).seasonal);
  const evidence = [
    ...[...found.values()].sort(
      (a, b) => FIELD_ORDER[a.field] - FIELD_ORDER[b.field],
    ),
    ...(christmasWord && ![...found.values()].length ? [christmasWord] : []),
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
      return `Atlas lists it as “${evidence.word}”`;
    case "activity":
      return `Atlas lists “${evidence.word}” as something to do here`;
    case "description":
      return `Its description says “${evidence.word}”`;
    case "organiser":
      return `The organiser says: “${evidence.quote}”`;
  }
}
