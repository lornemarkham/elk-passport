/**
 * **A fact the page already says better elsewhere is not a fact worth printing.**
 *
 * ## The problem, measured
 *
 * Atlas may hold five true representations of one thing, and it should — each
 * came from a different source and each is evidence. Passport rendering all
 * five is a different decision, and it was rendering all five. After the
 * identity mission merged two records for the Okanagan coffee festival, its
 * page printed the interval **four times**: once as WHEN, then as `Start
 * Date`, `End Date` and `Event Dates` — and `Location` immediately under the
 * WHERE that already named the venue.
 *
 * Consolidation did not cause that; it made it impossible to ignore. Merging
 * unions key facts, so every duplicate-in-meaning fact the corpus held for two
 * records arrived on one page at once.
 *
 * ## What this is, and what it is not
 *
 * This is a **read decision**. Nothing here deletes, withdraws or edits an
 * Atlas fact, and every rule is reversible by not calling it. It answers one
 * question per fact:
 *
 * > has this page already told the reader this, somewhere it reads better?
 *
 * Three rules, and no fourth. Each exists because the live corpus produced it:
 *
 * ```
 * already-rendered   the value restates the WHEN or the WHERE this page prints
 * in-description     the value is a sentence already inside the description
 * empty              the value carries no information — a label with a colon
 * ```
 *
 * Name matching is deliberately conservative: a fact is dropped only when its
 * value is *contained in* what the page already renders, or vice versa, after
 * normalising whitespace, case and punctuation. A fact that adds a detail — a
 * time inside a date, a room inside a building — keeps that detail and stays.
 */

export interface VisibilityContext {
  /** The interval as the page renders it, e.g. "Fri, Sep 25, 2026 – Sun, Nov 1, 2026". */
  readonly when?: string;
  /** The venue line as the page renders it, e.g. "O'Keefe Ranch Historic Site, 9380 Hwy 97". */
  readonly where?: string;
  /** The description the page prints above the facts. */
  readonly description?: string;
  /** Labels a curator has placed somewhere of their own on this page. */
  readonly placed?: ReadonlySet<string>;
}

export interface VisibleFact {
  readonly label: string;
  readonly value: string;
}

export interface HiddenFact extends VisibleFact {
  /** Which rule hid it, so a curator can see what the page decided and why. */
  readonly rule:
    | "placed"
    | "already-rendered"
    | "in-description"
    | "empty"
    | "restates-label";
}

/** Lowercase, unpunctuated, single-spaced — enough to compare two renderings of one sentence. */
export const normalizeForComparison = (value: string): string =>
  value
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐-―]/g, "-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const MONTHS: Readonly<Record<string, string>> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

/**
 * Every calendar day a piece of text states, as `YYYY-MM-DD`.
 *
 * Two spellings, because both appear in this corpus: `2026-10-03` from a
 * publisher's structured data, and `October 3rd and 4th, 2026` from its prose.
 * A month-and-day with no year of its own takes the text's year when the text
 * states exactly one — which is what makes `Sep 25 - Nov 01, 2026` two days
 * rather than one and a fragment.
 */
export function daysIn(text: string): ReadonlySet<string> {
  const days = new Set<string>();
  for (const m of text.matchAll(/(\d{4})-(\d{2})-(\d{2})/g))
    days.add(`${m[1]}-${m[2]}-${m[3]}`);

  const years = [
    ...new Set([...text.matchAll(/\b(20\d{2})\b/g)].map((m) => m[1]!)),
  ];
  const soleYear = years.length === 1 ? years[0] : undefined;
  const monthDay =
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(20\d{2}))?/gi;
  for (const m of text.matchAll(monthDay)) {
    const month = MONTHS[m[1]!.toLowerCase()]!;
    const year = m[3] ?? soleYear;
    if (!year) continue;
    days.add(`${year}-${month}-${String(m[2]).padStart(2, "0")}`);
  }
  return days;
}

/** Words that are only ever part of writing a date down. */
const DATE_WORDS =
  /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b|\b(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)[a-z]*\b|\b(and|to|through|from|until|till|the|of|st|nd|rd|th)\b|\d+/gi;

/** How many words are left once the date itself is taken out. */
function wordsBesidesTheDate(value: string): number {
  return value
    .replace(DATE_WORDS, " ")
    .replace(/[^a-z]+/gi, " ")
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 1).length;
}

const contains = (haystack: string, needle: string): boolean =>
  needle.length > 0 && haystack.length > 0 && haystack.includes(needle);

/**
 * Does `value` say something the page already rendered as `rendered`?
 *
 * Text containment first, in either direction — that catches a fact whose
 * value is a sentence lifted out of the description.
 *
 * Then dates, because the same day is written in incompatible ways by
 * different publishers: `2026-10-03` and `Sat, Oct 3, 2026` share no words at
 * all. Two conditions, and the second is what keeps a real fact: every day the
 * value states is already covered by what the page renders, **and** the value
 * is not much more than those days. `Sunday, November 1 is the final night of
 * the season` states a day inside the rendered interval and then says
 * something the page does not, so it stays.
 */
export function restates(value: string, rendered: string): boolean {
  const v = normalizeForComparison(value);
  const r = normalizeForComparison(rendered);
  if (v.length === 0 || r.length === 0) return false;
  if (contains(r, v) || contains(v, r)) return true;

  const mine = daysIn(value);
  if (mine.size > 0) {
    const theirs = daysIn(rendered);
    const covered = theirs.size > 0 && [...mine].every((d) => theirs.has(d));
    if (covered && wordsBesidesTheDate(value) <= 2) return true;
  }
  return false;
}

/** A value that carries nothing: empty, or a label's trailing colon with no list after it. */
const isEmpty = (value: string): boolean =>
  normalizeForComparison(value).length === 0;

/**
 * Split facts into what this page should print and what it should not.
 *
 * Pure, and it returns both halves: the hidden ones carry the rule that hid
 * them, so a curator can check the page's judgement rather than wonder where
 * a fact went.
 */
export function partitionFacts(
  facts: readonly VisibleFact[],
  context: VisibilityContext,
): {
  readonly visible: readonly VisibleFact[];
  readonly hidden: readonly HiddenFact[];
} {
  const visible: VisibleFact[] = [];
  const hidden: HiddenFact[] = [];
  const seen = new Set<string>();

  for (const fact of facts) {
    const key = `${normalizeForComparison(fact.label)}|${normalizeForComparison(fact.value)}`;
    // A merge can union the identical fact from two records. One is enough.
    if (seen.has(key)) {
      hidden.push({ ...fact, rule: "already-rendered" });
      continue;
    }
    seen.add(key);

    if (isEmpty(fact.value)) {
      hidden.push({ ...fact, rule: "empty" });
      continue;
    }
    // **A value that only repeats its own label states nothing.** A checkbox
    // on a ticketing page arrives as `Wheelchair Accessible — Wheelchair
    // Accessible` and `Includes fees & charges — Includes fees & charges`:
    // true, and shaped like storage. The label is kept and printed on its own
    // where a page wants it; the row is not.
    if (
      normalizeForComparison(fact.label) === normalizeForComparison(fact.value)
    ) {
      hidden.push({ ...fact, rule: "restates-label" });
      continue;
    }
    if (context.placed?.has(fact.label)) {
      hidden.push({ ...fact, rule: "placed" });
      continue;
    }
    if (
      (context.when && restates(fact.value, context.when)) ||
      (context.where && restates(fact.value, context.where))
    ) {
      hidden.push({ ...fact, rule: "already-rendered" });
      continue;
    }
    if (context.description && restates(fact.value, context.description)) {
      hidden.push({ ...fact, rule: "in-description" });
      continue;
    }
    visible.push(fact);
  }

  return { visible, hidden };
}
