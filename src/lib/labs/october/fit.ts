import type { Environment, SkyCondition } from "@/domain/environment/types";
import type { LightPhase } from "@/domain/environment/daylight";
import type { Possibility } from "./possibility";

/**
 * **Weather that changes what you are offered, rather than weather printed
 * next to it.**
 *
 * October already knows the sky. What it has done with that until now is
 * render a sentence beside a card whose position the sky had no part in
 * choosing — which is decoration, and the brief for these labs says so. Here
 * the reading moves the order and supplies the reason, and the reason is
 * always the evidence's own: *"rain until midnight"*, not *"we think you'd
 * prefer"*.
 *
 * ## Influence, never exclusion
 *
 * Nothing is removed for weather. A clear sky lifts astronomy to the top; it
 * does not delete the cinema. Rain lifts making and watching; the haunt is
 * still there, lower, with the rain said out loud so the person can decide
 * they do not care. The one thing a forecast is allowed to do is reorder and
 * explain, because a forecast is a probability and a person's plans are not
 * Passport's to cancel.
 *
 * The scores are small integers on purpose. They are a composition device, not
 * a model — nothing here is learned, tuned, or personalised, and every term
 * below can be read off against a single possibility by hand.
 */

export interface Weather {
  /** Tonight's sky where this person is, as the provider stated it. */
  readonly sky?: SkyCondition;
  /** Chance of precipitation tonight, 0–1, where the provider gave one. */
  readonly wet?: number;
  readonly lowC?: number;
  /** Day, dusk or night at this instant and place. */
  readonly light?: LightPhase;
  /** Who said so. Rendered wherever a reason quotes it. */
  readonly source?: string;
}

/** Reads tonight out of an `Environment`, or says it does not know. */
export function weatherFrom(
  environment: Environment | undefined,
  day: string,
  light: LightPhase | undefined,
): Weather {
  if (!environment) return { ...(light ? { light } : {}) };
  const night = environment.nights.find((n) => n.day === day);
  return {
    ...(night?.sky ? { sky: night.sky } : {}),
    ...(night?.precipitationChance !== undefined
      ? { wet: night.precipitationChance }
      : {}),
    ...(night?.lowC !== undefined ? { lowC: night.lowC } : {}),
    ...(light ? { light } : {}),
    source: environment.provenance.source,
  };
}

const WET: ReadonlySet<SkyCondition> = new Set(["precipitating"]);
const OPEN: ReadonlySet<SkyCondition> = new Set(["clear", "mainly-clear"]);

/** Is it actually raining on this evening, by sky or by stated chance? */
export const isWet = (w: Weather): boolean =>
  (w.sky !== undefined && WET.has(w.sky)) ||
  (w.wet !== undefined && w.wet >= 0.6);

/** Is the sky open enough for the sky itself to be the point? */
export const isOpen = (w: Weather): boolean =>
  w.sky !== undefined && OPEN.has(w.sky) && !isWet(w);

export interface Context {
  /** Today, local, `YYYY-MM-DD`. */
  readonly today: string;
  readonly weather: Weather;
  /** Days left in October, for the things that stop existing on the 1st. */
  readonly daysToHalloween?: number;
}

export interface Fit {
  readonly score: number;
  /**
   * Why this is where it is, in October's voice and tied to evidence. Absent
   * when the only reason is "it exists", which is most of the corpus and not
   * worth a sentence.
   */
  readonly because?: string;
}

/**
 * How well a possibility suits this evening.
 *
 * Read it top to bottom: time first (can I even do this tonight), then the
 * sky, then the clock, then the few authored nudges. A possibility that
 * matches nothing scores 0 and still appears — "no particular reason" is a
 * legitimate position in a feed and is where the surprises live.
 */
export function fitFor(p: Possibility, ctx: Context): Fit {
  const { weather: w } = ctx;
  let score = 0;
  let because: string | undefined;
  let weightOfBecause = 0;

  const say = (points: number, reason?: string) => {
    score += points;
    // **The strongest reason wins the sentence.** This used to keep the first
    // reason offered, which meant a clear night over a meteor shower was
    // explained as "On tonight, and only tonight" — true of half the page,
    // and not why that thing was at the top. Ties keep the earlier one.
    if (reason && points > weightOfBecause) {
      because = reason;
      weightOfBecause = points;
    }
  };

  // --------------------------------------------------- 1. can I, tonight
  if (p.availability.tonight) say(3);
  if (
    p.availability.shape === "fixed" &&
    p.availability.days[0] === ctx.today
  ) {
    say(2, "On tonight, and only tonight.");
  }
  if (p.availability.shape === "unstated") score -= 1;
  if (p.availability.needsPlanning) {
    // Not punished — relocated. A costume is a bad answer to "tonight" and a
    // very good answer to "this week", and the surfaces ask both.
    score -= 2;
    if (ctx.daysToHalloween !== undefined && ctx.daysToHalloween <= 10) {
      say(3, `${ctx.daysToHalloween} days left to make it.`);
    }
  }

  // ------------------------------------------------------------ 2. the sky
  if (isWet(w)) {
    if (p.setting === "indoor") say(3, "Rain tonight. This one is dry.");
    if (p.setting === "outdoor-night" || p.setting === "outdoor-day") {
      score -= 2;
    }
    if (p.setting === "astronomy") score -= 4;
  } else if (isOpen(w)) {
    if (p.setting === "astronomy") {
      say(5, "Clear sky tonight — the one thing this needs.");
    }
    if (p.setting === "outdoor-night") say(2, "Clear tonight. Dress warm.");
    if (p.setting === "outdoor-day" && w.light === "day") {
      say(2, "A good afternoon to be outside.");
    }
  }
  if (w.lowC !== undefined && w.lowC <= 0 && p.setting !== "indoor") {
    score -= 1;
  }

  // ---------------------------------------------------------- 3. the clock
  if (w.light === "night" || w.light === "dusk") {
    if (p.setting === "outdoor-day") score -= 3;
    if (p.setting === "astronomy" || p.setting === "outdoor-night") score += 1;
    // **A 9:45 a.m. event is a bad answer to "what shall we do tonight".**
    // Found by walking Experiment C: a Sunday-morning festival led the deck
    // because nobody had classified it, so no setting rule touched it. The
    // publisher's own clock time is the evidence, and it is only present
    // where a clock was actually published.
    const hour = p.availability.hour;
    if (hour !== undefined && hour < 15) score -= 3;
  }
  if (w.light === "day" && p.setting === "outdoor-day") score += 1;

  // ------------------------------------------------- 4. what it looks like
  // A visual slot needs a picture, so having one is worth a little in the
  // ordering that fills those slots. Deliberately small: this nudges which of
  // two equally good things leads, and never promotes a weak thing on looks.
  if (p.image) score += 1;

  return { score, ...(because ? { because } : {}) };
}

/**
 * Highest fit first, then a stable tiebreak so a feed never shuffles.
 *
 * The tiebreak is a hash of the id and **not** the title, which matters more
 * than it sounds: most of the anytime pool scores identically, so sorting ties
 * by name produced a lane reading *Arachnophobia, Beetlejuice, Casper,
 * Cemetery Man, Coraline*. Alphabetical order is the single clearest tell that
 * a person is looking at a database listing rather than a recommendation, and
 * it was the first thing visible in the lane meant to feel most open-ended.
 */
export function byFit(ctx: Context) {
  return (a: Possibility, b: Possibility): number => {
    const d = fitFor(b, ctx).score - fitFor(a, ctx).score;
    return d !== 0 ? d : idOrder(a.id) - idOrder(b.id);
  };
}

/** A fixed, arbitrary order from an id. Same every render, never alphabetical. */
function idOrder(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * One sentence about the evening itself, for a surface to open with.
 *
 * Returns nothing when the provider gave nothing, which is the state a dev
 * machine with no weather key is in — and an opening line that says the sky is
 * fine when nobody asked the sky would be the exact failure these labs exist
 * to avoid.
 */
export function eveningLine(w: Weather): string | undefined {
  if (isWet(w)) return "It is going to rain tonight.";
  if (isOpen(w)) {
    return w.lowC !== undefined && w.lowC <= 2
      ? "Clear and cold tonight."
      : "Clear tonight.";
  }
  if (w.sky === "overcast" || w.sky === "mostly-cloudy") {
    return "Cloudy tonight.";
  }
  return undefined;
}

/**
 * **Is this one about to stop existing?**
 *
 * Only a run can close — a single-date thing never had a run to lose, and
 * something with no dates at all cannot be ending. Two days or fewer left out
 * of a run of three or more is the shape that earns the word, which is the
 * same rule `domain/october/dontMiss` applies to Atlas subjects, said here
 * against a `Possibility` so films and Doings are asked the same question and
 * honestly answer no.
 */
export function closingSoon(
  days: readonly string[],
  today: string,
): { readonly lastDay: string; readonly daysLeft: number } | undefined {
  if (days.length < 3) return undefined;
  const left = days.filter((d) => d >= today);
  if (left.length === 0 || left.length > 2) return undefined;
  return { lastDay: left[left.length - 1], daysLeft: left.length };
}

/**
 * **No more than a couple in a row from the same place.**
 *
 * Found by using it: "be frightened" on a wet Thursday returned twelve films
 * and nothing else. Every one of them was correctly ranked — the film
 * catalogue is authored with a `fear` level, so it answers that question
 * better than anything Atlas holds, and rain had already pushed the haunts
 * down. The ranking was right and the result was a failure, because a surface
 * whose entire purpose is *"I had no idea all this existed"* had just shown
 * somebody one catalogue twelve times.
 *
 * So the order is a ranking **and** a composition. This walks the ranked list
 * and, whenever it is about to emit a third consecutive possibility from the
 * same source, reaches ahead for the best-ranked one from somewhere else. It
 * never promotes something that was not already in the list, and it never
 * drops anything — the tail still arrives, just later.
 */
export function mixSources<T extends { readonly source: string }>(
  ranked: readonly T[],
  maxRun = 2,
): readonly T[] {
  const left = [...ranked];
  const out: T[] = [];
  let run = 0;
  let last: string | undefined;

  while (left.length > 0) {
    let index = 0;
    if (last !== undefined && run >= maxRun) {
      const other = left.findIndex((p) => p.source !== last);
      // -1 means everything remaining is from the same source, which is a real
      // state near the bottom of a list. Then the run simply continues.
      if (other !== -1) index = other;
    }
    const next = left.splice(index, 1)[0];
    run = next.source === last ? run + 1 : 1;
    last = next.source;
    out.push(next);
  }
  return out;
}

/**
 * **A reason is worth saying once.**
 *
 * Measured on Experiment A under the rainy scenario: *"Rain tonight. This one
 * is dry."* appeared nine times down one page. Every instance was true and
 * every instance after the first was wallpaper — which is the precise failure
 * `domain/october/conditions` was written to avoid on production cards, and it
 * walked straight back in the moment a new surface started rendering reasons
 * of its own.
 *
 * So a page makes one of these and passes every reason through it. The first
 * card to carry a given sentence says it; the rest stay quiet and let the
 * reader assume it still applies, which they will, because it does.
 */
export function sayOnce(): (reason?: string) => string | undefined {
  const said = new Set<string>();
  return (reason) => {
    if (!reason || said.has(reason)) return undefined;
    said.add(reason);
    return reason;
  };
}
