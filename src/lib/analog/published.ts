import type { Experience } from "@/domain/experience/types";

/**
 * **What a place has published about itself, repeated in its own words.**
 *
 * `candidate-knowledge/1` carries `practical`: labelled facts a publisher
 * stated (hours, admission, parking). They are printed verbatim, never
 * summarised, because a paraphrase of an opening time is a new opening time.
 *
 * ## Hours have to look like hours
 *
 * Measured on the corpus, most "hours" facts are not hours: *"Opened in
 * September 1888 by Lord Stanley"* (`situation.ts`). So a fact counts as
 * opening hours only when its label says hours **and** its value has the
 * shape of a schedule: a clock time, a weekday, *daily*, *dawn*, *dusk*. A
 * label match alone is not enough to tell somebody a place will be open.
 */

export interface PublishedFact {
  readonly label: string;
  readonly value: string;
}

const HOURS_LABEL = /\bhours\b|^open(ing)?\b|^schedule$/i;

const HOURS_SHAPE =
  /\b\d{1,2}(:\d{2})?\s*(a\.?m\.?|p\.?m\.?)(?![a-z])|\b\d{1,2}:\d{2}\b|\b(mon|tues?|wed(nes)?|thu(rs?)?|fri|sat(ur)?|sun)(day)?s?\b|\bdaily\b|\bdawn\b|\bdusk\b|\b24 hours\b|\bclosed\b/i;

/** Long enough to be useful, short enough to print in a margin. */
const MAX = 220;

const factsOf = (experience: Experience): PublishedFact[] =>
  (experience.knowledge?.practical ?? [])
    .map((f) => ({
      label: f.label?.trim() ?? "",
      value: f.value?.trim() ?? "",
    }))
    .filter((f) => f.label && f.value && f.value.length <= MAX);

/** Published opening hours, in the publisher's words, or nothing. */
export function publishedHours(experience: Experience): string | undefined {
  return factsOf(experience).find(
    (f) => HOURS_LABEL.test(f.label) && HOURS_SHAPE.test(f.value),
  )?.value;
}

/**
 * The rest of what the place published: parking, access, what to bring.
 * Anything already printed as the price or the hours is left out, and so is
 * anything that names money, which the page already prints once as the cost.
 */
export function publishedFacts(
  experience: Experience,
  printed: readonly (string | undefined)[],
): PublishedFact[] {
  const already = new Set(
    printed.filter((p): p is string => Boolean(p)).map((p) => p.toLowerCase()),
  );
  const seen = new Set<string>();
  const out: PublishedFact[] = [];
  for (const fact of factsOf(experience)) {
    const key = fact.value.toLowerCase();
    if (already.has(key) || seen.has(key)) continue;
    if (/admission|price|cost|fee|ticket|rate|donation/i.test(fact.label))
      continue;
    if (HOURS_LABEL.test(fact.label)) continue;
    seen.add(key);
    out.push(fact);
  }
  return out.slice(0, 4);
}
