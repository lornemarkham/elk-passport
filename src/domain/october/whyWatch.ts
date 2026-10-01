import type { Film } from "@/lib/movies/catalogue";

/**
 * **Why somebody might want this film tonight, from what the catalogue holds.**
 *
 * Details are reference; discovery has to make you care. A grid of 28 titles
 * and years is reference — it tells you what exists and nothing about which
 * one is right for the room you are in. This is the other half.
 *
 * ## Nothing here is criticism, and nothing here is generated
 *
 * Every string below is a restatement of a field a person authored in
 * `lib/movies/catalogue.ts`, or arithmetic on `runtimeMinutes`. There is no
 * scoring, no inference from one axis to another, and no opinion this file
 * invented:
 *
 * ```
 * runtime      runtimeMinutes, formatted
 * commitment   runtimeMinutes, bucketed — the only derived value here
 * fear         the authored `fear` axis, said in words
 * audience     the authored `audience` ceiling, said in words
 * certification the published rating, with its board named
 * mechanisms   the authored `mechanisms`, verbatim
 * ```
 *
 * The actual editorial — the reason to care — is `film.line`, which a person
 * wrote about a film they had seen. Passport renders it; it does not produce
 * anything like it. If a film needs a better reason than the one it has, that
 * is a line to write in the catalogue, not a sentence to synthesize here.
 *
 * ## The two axes stay independent
 *
 * `fear` and `audience` are authored separately and mean different things —
 * Coraline is PG and genuinely creepy; The Addams Family is PG-13 and cozy.
 * Nothing in this file derives one from the other, or from the certification.
 */

/** `25 min`, `1h 36m` — the runtime as a person would say it. */
export function formatRuntime(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/**
 * What the runtime asks of an evening.
 *
 * The one value on this page derived rather than restated, and it is derived
 * from a single number. The catalogue runs 25 to 146 minutes, which is the
 * difference between "before the kids go up" and "commit to this".
 */
export function commitmentOf(minutes: number): string {
  if (minutes <= 45) return "Under an hour";
  if (minutes <= 100) return "Easy weeknight";
  if (minutes <= 125) return "A proper sit-down";
  return "A long one";
}

/** The authored fear axis, in words. Never derived from the certification. */
const FEAR_SAYS = {
  cozy: "Not trying to scare you",
  spooky: "Spooky, not scary",
  creepy: "Gets under your skin",
  nightmare: "Actually frightening",
} as const;

/** The authored audience ceiling, in words. Never derived from fear. */
const AUDIENCE_SAYS = {
  kids: "Fine with kids",
  teens: "Teens and up",
  adults: "Adults",
} as const;

export interface FilmFacts {
  /** `1h 36m`. */
  readonly runtime: string;
  /** `Easy weeknight`. */
  readonly commitment: string;
  /** `Actually frightening`. */
  readonly fear: string;
  /** `Fine with kids`. */
  readonly audience: string;
  readonly year: number;
  /**
   * `PG-13 · MPA` — shown with the board named, because certifications are
   * not universal. British Columbia uses Consumer Protection BC and does not
   * always agree. Evidence, never a filter.
   *
   * **Absent for most of the catalogue**, and that is the honest answer: the
   * MPA never rated the Canadian, Japanese, Spanish and Italian films here,
   * and a plausible-looking guess would be a fabricated fact about a real
   * film. `audience` carries the weight instead.
   */
  readonly certification?: string;
  /** Why it works on people, authored per film. Verbatim. */
  readonly mechanisms: readonly string[];
  /** October's one authored sentence about this film. The actual reason. */
  readonly line: string;
}

export function factsFor(film: Film): FilmFacts {
  return {
    runtime: formatRuntime(film.runtimeMinutes),
    commitment: commitmentOf(film.runtimeMinutes),
    fear: FEAR_SAYS[film.fear],
    audience: AUDIENCE_SAYS[film.audience],
    year: film.year,
    certification: film.certification
      ? `${film.certification.code} · ${film.certification.system}`
      : undefined,
    mechanisms: film.mechanisms,
    line: film.line,
  };
}

/**
 * The two or three facts worth putting on a card, in the order they help.
 *
 * A card cannot carry six chips without becoming a specification sheet, and
 * the question it has to answer is *is this the right film for tonight* —
 * which is how long it takes, how frightening it is, and who can watch it.
 * The certification and the mechanisms are reference, and they wait for the
 * detail page.
 */
export function cardFactsFor(film: Film): readonly string[] {
  const facts = factsFor(film);
  return [facts.runtime, facts.fear, facts.audience];
}
