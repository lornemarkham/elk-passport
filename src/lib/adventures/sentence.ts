/**
 * **A change to an adventure, said in words** (ADR 012 §3).
 *
 * The Day Builder already reads a change to *one* day (`reviseBrief`,
 * `replacedStop`, `removedStop`, `stopCountChange`). An adventure has
 * several, so this is only the part in front of that reader:
 *
 * - **which days** the sentence is about — _"make Saturday more
 *   adventurous"_ is Saturday; _"make it cheaper"_ on a weekend is all of it;
 * - **the one change that is about days, not stops** — _"swap Saturday and
 *   Sunday"_;
 * - **a handful of ways people say things the reader knows under another
 *   name** — _"a rainy-day alternative"_ is the reader's _"out of the
 *   rain"_; _"less demanding"_ is _"easier"_ with a stop fewer.
 *
 * Deterministic and pure. A model, if one is ever wired in, would fill the
 * same request and never name a place (doctrine §3, roadmap DAY-04).
 */

export type ChangeRequest =
  | {
      readonly kind: "swap";
      readonly days: readonly [string, string];
    }
  | {
      readonly kind: "revise";
      /** The days to rebuild, in calendar order. */
      readonly days: readonly string[];
      /** What the day reader is handed. */
      readonly said: string;
      /** Take a stop away too (_"less demanding"_). */
      readonly fewer: boolean;
    }
  | { readonly kind: "none"; readonly reply: string };

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

const SHORT: Readonly<Record<string, (typeof WEEKDAYS)[number]>> = {
  sun: "sunday",
  mon: "monday",
  tue: "tuesday",
  tues: "tuesday",
  wed: "wednesday",
  thu: "thursday",
  thur: "thursday",
  thurs: "thursday",
  fri: "friday",
  sat: "saturday",
};

const weekdayOf = (iso: string) =>
  WEEKDAYS[new Date(`${iso}T12:00:00Z`).getUTCDay()]!;

const DAY_WORD = new RegExp(
  `\\b(${[...WEEKDAYS, ...Object.keys(SHORT)].join("|")})s?\\b`,
  "gi",
);
const ORDINAL: Readonly<Record<string, number>> = {
  first: 0,
  "1st": 0,
  one: 0,
  "1": 0,
  second: 1,
  "2nd": 1,
  two: 1,
  "2": 1,
  third: 2,
  "3rd": 2,
  three: 2,
  "3": 2,
};

/** Days the sentence names, by weekday, by "day two", "the last day" or "today". */
export function daysNamed(
  said: string,
  days: readonly string[],
  today?: string,
): string[] {
  const lowered = said.toLowerCase();
  const named = new Set<string>();
  for (const match of lowered.matchAll(DAY_WORD)) {
    const word = match[1]!.toLowerCase();
    const weekday = SHORT[word] ?? word;
    for (const day of days) if (weekdayOf(day) === weekday) named.add(day);
  }
  for (const match of lowered.matchAll(
    /\b(?:the\s+)?(first|second|third|1st|2nd|3rd)\s+day\b|\bday\s+(one|two|three|1|2|3)\b/g,
  )) {
    const at = ORDINAL[(match[1] ?? match[2])!];
    if (at !== undefined && days[at]) named.add(days[at]!);
  }
  if (/\b(?:the\s+)?last\s+day\b/.test(lowered) && days.length > 0)
    named.add(days[days.length - 1]!);
  if (/\btoday\b/.test(lowered) && today && days.includes(today))
    named.add(today);
  return days.filter((d) => named.has(d));
}

/** Ways of saying something the day reader knows under another name. */
const SYNONYMS: readonly [RegExp, string][] = [
  [
    /\b(?:a\s+)?rain(?:y)?(?:[\s-]day)?(?:\s+(?:alternative|option|plan|backup))?\b|\bif it rains\b|\bwet weather\b/g,
    "out of the rain",
  ],
  [
    /\bless demanding\b|\bless (?:busy|packed|rushed)\b|\bnot so (?:busy|packed|much)\b|\bslow(?:er)?(?: it)? down\b|\blighter\b|\bmore relaxed\b|\bmore chill\b/g,
    "easier",
  ],
];
const FEWER =
  /\bless demanding\b|\bless (?:busy|packed|rushed)\b|\bnot so (?:busy|packed|much)\b|\bslow(?:er)?(?: it)? down\b|\blighter\b/;

/**
 * Read an adventure-level change. `days` are the adventure's days in
 * calendar order (with stops or not). A sentence that names no day is about
 * all of them — _"keep everything within 30 minutes"_.
 */
export function readChange(
  said: string,
  days: readonly string[],
  today?: string,
): ChangeRequest {
  const text = said.trim();
  if (!text) return { kind: "none", reply: "Say what you'd like to change." };
  if (days.length === 0)
    return {
      kind: "none",
      reply:
        "This adventure has no days yet. Give it dates first, then tell me what to change.",
    };

  const named = daysNamed(text, days, today);
  if (/\b(swap|switch|trade|flip)\b/i.test(text) && named.length === 2) {
    return { kind: "swap", days: [named[0]!, named[1]!] };
  }
  if (/\b(swap|switch|flip)\b.*\bdays\b/i.test(text) && days.length === 2) {
    return { kind: "swap", days: [days[0]!, days[1]!] };
  }

  // The day words are the target, not part of the change.
  let rest = text
    .replace(DAY_WORD, " ")
    .replace(
      /\b(?:the\s+)?(?:first|second|third|last|1st|2nd|3rd)\s+day\b|\bday\s+(?:one|two|three|1|2|3)\b|\btoday\b/gi,
      " ",
    )
    .replace(/\b(?:on|for)\s+(?=[,.!?]|$)/gi, " ")
    .replace(/\b(both|all)\s+days\b|\bthe (?:whole )?weekend\b/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  const fewer = FEWER.test(rest.toLowerCase());
  for (const [pattern, words] of SYNONYMS) rest = rest.replace(pattern, words);
  // "make  more adventurous" once the day is lifted out → "make it more adventurous".
  rest = rest.replace(/^make\s+(?=more|less|it\b)/i, "make it ").trim();

  return {
    kind: "revise",
    days: named.length > 0 ? named : [...days],
    said: rest || text,
    fewer,
  };
}

// ------------------------------------------------------------ the start

/** What kind of day, in the guided start — each a phrase the reader knows. */
export const VIBES = [
  { id: "adventurous", label: "Adventurous", says: "something adventurous" },
  { id: "outdoors", label: "Outdoors", says: "get outside" },
  { id: "food", label: "Food & drink", says: "good food and drink" },
  { id: "culture", label: "Arts & culture", says: "art and culture" },
  { id: "easy", label: "Easy-going", says: "take it easy" },
  { id: "weird", label: "Something different", says: "something weird" },
  { id: "rain", label: "Out of the rain", says: "out of the rain" },
] as const;

export type VibeId = (typeof VIBES)[number]["id"];

export const PARTIES = [
  { id: "solo", label: "Just me", says: "just me" },
  { id: "couple", label: "The two of us", says: "the two of us" },
  { id: "friends", label: "Friends", says: "with friends" },
  { id: "family", label: "Family", says: "with the kids" },
] as const;

export type PartyId = (typeof PARTIES)[number]["id"];

/**
 * **The guided start, said as one sentence** — the sentence the Day Builder
 * reads for every day of the adventure, and the one each day keeps so it can
 * be changed later. Nothing is asked that the reader cannot use.
 */
export function startSentence(input: {
  readonly vibes: readonly VibeId[];
  readonly party?: PartyId;
  readonly childAge?: number;
  readonly extra?: string;
}): string {
  const parts: string[] = VIBES.filter((v) => input.vibes.includes(v.id)).map(
    (v) => v.says,
  );
  if (parts.length === 0) parts.push("a great day out");
  const party = PARTIES.find((p) => p.id === input.party);
  if (party) parts.push(party.says);
  if (input.party === "family" && input.childAge !== undefined)
    parts.push(`youngest is ${input.childAge}`);
  const extra = input.extra?.trim();
  if (extra) parts.push(extra);
  return parts.join(", ").slice(0, 300);
}
