import type { Possibility } from "@/lib/labs/october/possibility";
import { search } from "@/lib/labs/october/search";
import {
  applyFilters,
  type Applied,
  type Days,
} from "@/lib/labs/october/filters";
import { closingSoon, mixSources, type Context } from "@/lib/labs/october/fit";
import { stableJitter } from "@/lib/labs/october/intents";
import { weight, type DiscoveryIntent } from "./intent";

/**
 * **One way in, one way out.**
 *
 * Every surface in the synthesis — the editorial opening, the feel-like
 * phrases, Trust Me, the search box, the full filter panel — calls this and
 * nothing else. That is the difference between a synthesis and four
 * prototypes sharing a stylesheet: there is exactly one implementation of
 * *what does this person's wish mean*, and the modes differ only in how they
 * collect the wish and how they present what comes back.
 *
 * ## It composes, it does not reimplement
 *
 * Search, filtering, contextual ranking and source mixing already exist and
 * are already tested. This file is the order they run in and the handful of
 * decisions that only make sense once they are combined:
 *
 * 1. **search** narrows the universe, if anything was typed
 * 2. **filters** narrow it again, by the intent's keys
 * 3. **ranking** orders what is left — by relevance if typed, by the
 *    personality's own bias otherwise
 * 4. **composition** stops one catalogue owning a run
 *
 * ## The personality supplies the bias, not this file
 *
 * `rank` is passed in. October hands over a comparator that knows about rain
 * and sunset; a different Passport personality would hand over a different
 * one, and nothing here would change. Nothing in this file knows what month
 * it is.
 */

export interface Resolved {
  readonly results: readonly Possibility[];
  /** Things that could not answer the question. Offered, never silently cut. */
  readonly unanswered: Applied["unanswered"];
  /** How many separate things were asked for. 0 is the arrival state. */
  readonly asked: number;
}

export interface EngineOptions {
  readonly pool: readonly Possibility[];
  readonly intent: DiscoveryIntent;
  readonly days: Days;
  /** The personality's ordering. October's knows about the sky. */
  readonly rank: (a: Possibility, b: Possibility) => number;
}

export function resolve({ pool, intent, days, rank }: EngineOptions): Resolved {
  const typed = (intent.query ?? "").trim().length > 1;

  const searched = typed
    ? search(pool, intent.query!, pool.length).map((h) => h.possibility)
    : pool;

  const chosen = new Set<string>([
    ...(intent.when ?? []),
    ...(intent.feel ?? []),
    ...(intent.doing ?? []),
    ...(intent.looking ?? []),
    ...(intent.where ?? []),
  ]);
  const withDay: Days = intent.on ? { ...days, picked: intent.on } : days;
  const applied = applyFilters(searched, chosen, withDay);

  const asked = weight(intent);

  // A query has already ranked by relevance; re-sorting would throw that away.
  const ordered = typed
    ? [...applied.results]
    : [...applied.results].sort(preferring(intent, rank));

  return {
    // With nothing asked for, alternate strictly — the arrival page should
    // not be two-thirds one catalogue. Once somebody has filtered to Watch,
    // a run of films is the correct answer and the cap relaxes.
    results: mixSources(ordered, asked === 0 ? 1 : 2),
    unanswered: applied.unanswered,
    asked,
  };
}

/**
 * The personality's ordering, with the two adjustments that belong to the
 * *intent* rather than to the evening.
 *
 * Both were found by using Experiment D and neither belongs in the weather
 * model: they are about what was asked for, not about what the sky is doing.
 */
function preferring(
  intent: DiscoveryIntent,
  rank: (a: Possibility, b: Possibility) => number,
) {
  const askedForADay =
    Boolean(intent.on) || (intent.when ?? []).some((k) => k !== "anytime");

  return (a: Possibility, b: Possibility): number => {
    if (intent.surprise) {
      // Backwards on purpose. The point of asking to be surprised is to reach
      // the things a well-behaved contextual feed buries.
      const flip = rank(b, a);
      if (flip !== 0) return flip;
      return stableJitter(a.id, 997) - stableJitter(b.id, 997);
    }

    // **How much is this thing about the day you asked for?** A one-night
    // event answers "what is on Saturday"; a gallery exhibition that has been
    // open since March does not, however true it is that it is open.
    if (askedForADay) {
      const d = specificity(b) - specificity(a);
      if (d !== 0) return d;
    }

    // A stated length that busts the time somebody has sinks; an unstated one
    // is left alone, because most of the corpus states none and treating
    // silence as "too long" would be a claim.
    if (intent.within !== undefined) {
      const fits = (p: Possibility) =>
        p.minutes === undefined ? 1 : p.minutes <= intent.within! ? 2 : 0;
      const d = fits(b) - fits(a);
      if (d !== 0) return d;
    }

    return rank(a, b);
  };
}

/**
 * How specifically a thing belongs to a named day.
 *
 * The threshold follows the production calendar's own `OCCASION_MAX_DAYS` —
 * three weeks is where an occasion stops being one.
 */
function specificity(p: Possibility): number {
  const n = p.availability.days.length;
  if (p.availability.shape === "fixed" && n <= 1) return 3;
  if (n > 1 && n <= 7) return 2;
  if (n > 7 && n <= 21) return 1;
  return 0;
}

/**
 * **The editorial composition** — the same results, cut into sections a person
 * can read rather than one undifferentiated list.
 *
 * This is Experiment A's contribution, and it survives because the sections
 * are **temporal promises** rather than content types: what you could do now,
 * what is about to stop, what is coming, what will keep. A section is allowed
 * to be empty and most evenings several are.
 *
 * It runs only on the arrival state. The moment somebody asks for something,
 * one honest list is the better answer and sections become decoration.
 */
export interface Section {
  readonly id: string;
  readonly title: string;
  readonly line?: string;
  readonly items: readonly Possibility[];
}

export function compose(
  resolved: Resolved,
  today: string,
  titles: {
    readonly alsoTonight: { title: string; line?: string };
    readonly closing: { title: string; line?: string };
    readonly ahead: { title: string; line?: string };
    readonly whenever: { title: string; line?: string };
  },
  options: { readonly skip?: ReadonlySet<string> } = {},
): readonly Section[] {
  const used = new Set(options.skip ?? []);
  const take = (from: readonly Possibility[], n: number) => {
    const out: Possibility[] = [];
    for (const p of from) {
      if (used.has(p.id) || out.length >= n) continue;
      used.add(p.id);
      out.push(p);
    }
    // Filtering a mixed list can un-mix it, so each lane is composed again.
    return mixSources(out);
  };

  const all = resolved.results;
  const sections: Section[] = [
    {
      id: "tonight",
      ...titles.alsoTonight,
      items: take(
        all.filter((p) => p.availability.tonight),
        4,
      ),
    },
    {
      id: "closing",
      ...titles.closing,
      items: take(
        all.filter((p) => closingSoon(p.availability.days, today)),
        2,
      ),
    },
    {
      id: "ahead",
      ...titles.ahead,
      items: take(
        all
          .filter(
            (p) =>
              !p.availability.tonight &&
              p.availability.days.some((d) => d > today),
          )
          .sort((a, b) =>
            (a.availability.days.find((d) => d > today) ?? "").localeCompare(
              b.availability.days.find((d) => d > today) ?? "",
            ),
          ),
        4,
      ),
    },
    {
      id: "whenever",
      ...titles.whenever,
      items: take(
        all.filter((p) => p.availability.shape === "anytime"),
        6,
      ),
    },
  ];

  return sections.filter((s) => s.items.length > 0);
}

export type { Context, Days };
