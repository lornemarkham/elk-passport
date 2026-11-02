import { DISCOVERY_TOWNS } from "@/domain/discovery/towns";
import type { Party } from "./discover";
import type { ShapeId } from "./plans";
import { addDays } from "./when";

/**
 * **"We have Saturday afternoon, two kids, and $100."**
 *
 * Reads a sentence into the few things the Christmas planner asks — which
 * shape of adventure, which day, who with, which children's ages, where — and
 * nothing more. It never invents: a word it does not recognise is left
 * unread, and the *whole* sentence still goes on to the Day Builder (which
 * reads "$100", "afternoon", "romantic" itself), so the budget and the time
 * of day are honoured by the one planner rather than approximated here.
 *
 * The reading is shown to the person in the planner's own fields before
 * anything is created, so a wrong reading is a visible, editable mistake.
 */

export interface Sentence {
  readonly shape: ShapeId;
  readonly from?: string;
  readonly party?: Party;
  readonly ages: readonly number[];
  readonly at?: string;
  /** The words as said, trimmed — handed on to the Day Builder untouched. */
  readonly say: string;
}

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];
const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

const dow = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay();

/** The next time the weekday comes round — today, if today is it. */
function nextWeekday(today: string, target: number): string {
  return addDays(today, (target - dow(today) + 7) % 7);
}

function dayIn(text: string, today: string): string | undefined {
  if (/\b(?:tonight|today|this (?:evening|afternoon|morning))\b/.test(text))
    return today;
  if (/\btomorrow\b/.test(text)) return addDays(today, 1);
  const month = text.match(
    new RegExp(
      `\\b(${MONTHS.join("|")})[a-z]*\\.? (\\d{1,2})(?:st|nd|rd|th)?\\b`,
    ),
  );
  if (month) {
    const m = MONTHS.indexOf(month[1]!) + 1;
    const d = Number(month[2]);
    if (d >= 1 && d <= 31) {
      const year = Number(today.slice(0, 4));
      const make = (y: number) =>
        `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const here = make(year);
      const picked = here >= today ? here : make(year + 1);
      // A date that does not exist (Feb 30) is not a date.
      if (new Date(`${picked}T12:00:00Z`).getUTCDate() === d) return picked;
    }
  }
  for (let i = 0; i < 7; i++)
    if (new RegExp(`\\b${WEEKDAYS[i]}\\b`).test(text))
      return nextWeekday(today, i);
  if (/\bweekend\b/.test(text)) return nextWeekday(today, 6);
  return undefined;
}

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
  eleven: 11,
  twelve: 12,
};

function agesIn(text: string): number[] {
  const ages: number[] = [];
  for (const m of text.matchAll(/\b(\d{1,2})[ -]?(?:years?|yrs?)[ -]?old\b/g))
    ages.push(Number(m[1]));
  for (const m of text.matchAll(
    /\baged? (\d{1,2}(?:(?:,| and|,? &) ?\d{1,2})*)/g,
  ))
    for (const n of m[1]!.match(/\d{1,2}/g) ?? []) ages.push(Number(n));
  for (const m of text.matchAll(
    new RegExp(
      `\\b(${Object.keys(NUMBER_WORDS).join("|")})[ -]year[ -]olds?\\b`,
      "g",
    ),
  ))
    ages.push(NUMBER_WORDS[m[1]!]!);
  return [...new Set(ages.filter((n) => n >= 0 && n <= 17))].slice(0, 6);
}

function townIn(text: string): string | undefined {
  // Longest name first, so "North Vancouver" is not read as "Vancouver".
  const names = DISCOVERY_TOWNS.flatMap((t) => [
    { id: t.id, name: t.name.replace(/,\s*BC$/, "").toLowerCase() },
    ...(t.aliases ?? []).map((a) => ({ id: t.id, name: a })),
  ]).sort((a, b) => b.name.length - a.name.length);
  for (const { id, name } of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${escaped}\\b`).test(text)) return id;
  }
  return undefined;
}

export function readSentence(input: string, today: string): Sentence {
  const say = input.replace(/\s+/g, " ").trim().slice(0, 200);
  const text = say.toLowerCase();

  const couple =
    /\b(?:romantic|date(?: night)?|anniversary|the two of us|just the two|my (?:wife|husband|partner|girlfriend|boyfriend|fianc[eé]e?)|couple)\b/.test(
      text,
    );
  const kids =
    /\b(?:kids?|children|child|toddlers?|babies|baby|family|daughter|son|nieces?|nephews?|grandkids?|\d{1,2}[ -]?(?:years?|yrs?)[ -]?old|year[ -]olds?)\b/.test(
      text,
    );
  const friends =
    /\b(?:friends?|buddies|the (?:girls|boys|crew|gang)|mates)\b/.test(text);
  const solo = /\b(?:just me|by myself|solo|on my own)\b/.test(text);
  const party: Party | undefined = kids
    ? "family"
    : couple
      ? "couple"
      : friends
        ? "friends"
        : solo
          ? "solo"
          : undefined;

  const evening =
    /\b(?:evening|tonight|night|after dark|romantic|date night)\b/.test(text);
  const daytime = /\b(?:afternoon|morning|daytime|lunch|day)\b/.test(text);
  const shape: ShapeId =
    /\b(?:3|three|4|four|5|five)[ -]days?\b|\bfive days\b/.test(text)
      ? "multi"
      : /\bweekend\b/.test(text)
        ? "weekend"
        : /\bmarkets?\b/.test(text)
          ? "market"
          : kids
            ? "family-day"
            : (evening || couple) && !daytime
              ? "evening"
              : "market";

  const from = dayIn(text, today);
  const ages = agesIn(text);
  const at = townIn(text);
  return {
    shape,
    ...(from ? { from } : {}),
    ...(party ? { party } : {}),
    ages,
    ...(at ? { at } : {}),
    say,
  };
}

/** The planner's address for a reading — the URL is the state. */
export function planHref(read: Sentence, also: { at?: string } = {}): string {
  const q = new URLSearchParams({ shape: read.shape });
  const at = read.at ?? also.at;
  if (at) q.set("at", at);
  if (read.from) q.set("from", read.from);
  if (read.party) q.set("who", read.party);
  if (read.ages.length) q.set("ages", read.ages.join(","));
  if (read.say) q.set("say", read.say);
  return `/christmas/plan?${q.toString()}`;
}
