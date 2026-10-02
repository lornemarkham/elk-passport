import type { Possibility } from "./possibility";

/**
 * **The smallest set of filters that describe a decision rather than a table.**
 *
 * Every one of these had to pass the same test before it was allowed in: can
 * the current evidence answer it honestly for most of the pool? That ruled out
 * several obvious-sounding filters — price (Atlas states none), distance (no
 * locality on most subjects), age range (only a boolean exists) — and it is
 * why there are eleven of these and not thirty.
 *
 * ## Three groups, and they combine
 *
 * Within a group the selections are an **or** (Tonight or Tomorrow). Across
 * groups they are an **and** (Tonight *and* Stay in). That is the combination
 * rule people already expect from every shop they have ever used, and it is
 * the only one worth having.
 *
 * ## Absence is not a match, and it is not a disappearance either
 *
 * Two large parts of this corpus cannot answer two of these groups: 59% of
 * Atlas subjects have no indoor/outdoor classification, and a handful of the
 * best things publish no dates at all. Neither is quietly folded into a match
 * — a thing with no stated dates must never turn up under "Tonight" — and
 * neither is quietly dropped. `unanswered` counts them so the surface can
 * offer them beside the results instead of pretending they do not exist.
 */

/** The local days a surface needs in order to ask temporal questions. */
export interface Days {
  readonly today: string;
  readonly tomorrow: string;
  /** The coming Friday, Saturday and Sunday, as local days. */
  readonly weekend: readonly string[];
  /** A specific day somebody picked, if they picked one. */
  readonly picked?: string;
}

export type FilterGroup = "when" | "feel" | "doing" | "looking" | "where";

export interface FilterDef {
  readonly id: string;
  readonly group: FilterGroup;
  readonly label: string;
  /** Why this one exists, for the lab report. Never rendered. */
  readonly basis: string;
  matches(p: Possibility, days: Days): boolean;
}

/**
 * **Is this available on a given day?**
 *
 * A dated thing answers from its own days. A film or a Doing with no date is
 * available on every day, so it answers yes — that is the whole point of
 * mixing them into one result set, and a "Tonight" that excluded every film
 * would be a worse answer than the one Passport already gives.
 *
 * A `deadline` thing (a costume) is available until Halloween, so it answers
 * yes for any October day. An `unstated` thing answers **no** to every
 * specific day, because nobody published one and a maybe shown as a yes is the
 * failure mode this whole model exists to avoid.
 */
export function availableOn(p: Possibility, day: string): boolean {
  const { shape, days } = p.availability;
  if (shape === "anytime" || shape === "deadline") return true;
  if (shape === "unstated") return false;
  return days.includes(day);
}

export const FILTERS: readonly FilterDef[] = [
  // ------------------------------------------------------------------ when
  {
    id: "tonight",
    group: "when",
    label: "Tonight",
    basis: "Dated for today, or undated and therefore always available.",
    matches: (p, d) => availableOn(p, d.today),
  },
  {
    id: "tomorrow",
    group: "when",
    label: "Tomorrow",
    basis: "Same question, one day later.",
    matches: (p, d) => availableOn(p, d.tomorrow),
  },
  {
    id: "weekend",
    group: "when",
    label: "This weekend",
    basis: "Friday, Saturday or Sunday of the coming weekend.",
    matches: (p, d) => d.weekend.some((day) => availableOn(p, day)),
  },
  {
    id: "anytime",
    group: "when",
    label: "Anytime",
    basis: "No date at all — a film, a thing to make. Never an Event.",
    matches: (p) =>
      p.availability.shape === "anytime" || p.availability.shape === "deadline",
  },

  // ------------------------------------------------------------------ feel
  {
    id: "go-out",
    group: "feel",
    label: "Go out",
    basis: "Something in the world, with a venue or an organiser.",
    matches: (p) => p.tags.includes("go-out"),
  },
  {
    id: "stay-in",
    group: "feel",
    label: "Stay in",
    basis: "A film or a thing to make, at home.",
    matches: (p) => p.tags.includes("stay-in"),
  },
  {
    id: "watch",
    group: "doing",
    label: "Watch",
    basis: "Passport's own authored film catalogue — 44 titles.",
    matches: (p) => p.source === "movie",
  },
  {
    id: "make",
    group: "doing",
    label: "Make",
    basis: "Passport's own authored Doings catalogue — 26 things to make.",
    matches: (p) => p.source === "doing",
  },
  {
    id: "family",
    group: "looking",
    label: "Family",
    basis:
      "Authored `withKids` on a Doing, `audience: kids` on a film, or Atlas's own words. Nothing frightening is ever included.",
    matches: (p) =>
      ((p.withKids ?? false) || /\bfamily|\bkids?\b|children/.test(p.text)) &&
      (p.scare ?? 0) < 2,
  },
  {
    id: "scary",
    group: "looking",
    label: "Scary",
    basis:
      "Authored fear of creepy or worse, or a haunt — by Atlas's own description, not by a guess at the title.",
    matches: (p) =>
      (p.scare ?? 0) >= 2 ||
      /haunt|fright|scream|horror|terror|ghost|spook/.test(p.text),
  },

  // ----------------------------------------------------------------- where
  {
    id: "indoor",
    group: "where",
    label: "Indoors",
    basis: "Atlas's own venue classification, or a film.",
    matches: (p) => p.setting === "indoor",
  },
  {
    id: "outdoor",
    group: "where",
    label: "Outdoors",
    basis: "Atlas's own classification, day or night.",
    matches: (p) =>
      p.setting === "outdoor-day" || p.setting === "outdoor-night",
  },
  {
    id: "sky",
    group: "where",
    label: "Needs a clear sky",
    basis: "Atlas classified it as astronomy. Three things in the pool.",
    matches: (p) => p.setting === "astronomy",
  },
];

export const filterById = (id: string): FilterDef | undefined =>
  FILTERS.find((f) => f.id === id);

/**
 * **Four groups, because four different questions are being asked.**
 *
 * Both splits here were forced by using the thing.
 *
 * *Watch + Scary* returned every film **and** every frightening thing,
 * including a Doing about paper ghosts — a medium and a mood are different
 * questions and have to meet as an **and**. So Family and Scary left.
 *
 * Then *Stay in + Watch* returned everything you can do at home as well as
 * every film, because Watch is a **subset** of Stay in rather than an
 * alternative to it. Or-ing a set with its own subset is a no-op that reads
 * as a broken filter. So Watch and Make left too.
 *
 * What remains in each group really are alternatives: two days, two places to
 * be, two things to do with your hands, two moods.
 */
export const GROUP_LABEL: Readonly<Record<FilterGroup, string>> = {
  when: "When",
  feel: "Feel like",
  doing: "Doing",
  looking: "Looking for",
  where: "Where",
};

export interface Applied {
  readonly results: readonly Possibility[];
  /**
   * Things that could not answer the question, per group — not matches, not
   * losses. A surface offers these rather than hiding them.
   */
  readonly unanswered: {
    readonly when: readonly Possibility[];
    readonly where: readonly Possibility[];
  };
}

/**
 * Apply the chosen filters: or within a group, and across groups.
 *
 * `picked` is handled as part of the `when` group so that choosing a date
 * behaves exactly like choosing Tonight — the question is the same one.
 */
export function applyFilters(
  pool: readonly Possibility[],
  chosen: ReadonlySet<string>,
  days: Days,
): Applied {
  const byGroup = (group: FilterGroup) =>
    FILTERS.filter((f) => f.group === group && chosen.has(f.id));

  const when = byGroup("when");
  const feel = byGroup("feel");
  const doing = byGroup("doing");
  const looking = byGroup("looking");
  const where = byGroup("where");
  const askingWhen = when.length > 0 || days.picked !== undefined;
  const askingWhere = where.length > 0;

  const matchesWhen = (p: Possibility) =>
    (when.length === 0 || when.some((f) => f.matches(p, days))) &&
    (days.picked === undefined || availableOn(p, days.picked));

  /** Every non-temporal group a possibility must satisfy. */
  const matchesTaste = (p: Possibility) =>
    (feel.length === 0 || feel.some((f) => f.matches(p, days))) &&
    (doing.length === 0 || doing.some((f) => f.matches(p, days))) &&
    (looking.length === 0 || looking.some((f) => f.matches(p, days)));

  const results: Possibility[] = [];
  const noDates: Possibility[] = [];
  const noSetting: Possibility[] = [];

  for (const p of pool) {
    // The two honest "cannot say" states, taken out before anything is matched
    // so that a filtered page never implies a claim nobody made.
    if (askingWhen && p.availability.shape === "unstated") {
      if (matchesTaste(p)) noDates.push(p);
      continue;
    }
    if (askingWhere && p.setting === "unknown") {
      if (matchesWhen(p) && matchesTaste(p)) noSetting.push(p);
      continue;
    }
    if (!matchesWhen(p)) continue;
    if (!matchesTaste(p)) continue;
    if (where.length > 0 && !where.some((f) => f.matches(p, days))) continue;
    results.push(p);
  }

  return { results, unanswered: { when: noDates, where: noSetting } };
}

/** The sentence a surface prints over the results. Plain, never clever. */
export function describe(
  chosen: ReadonlySet<string>,
  days: Days,
  query: string,
): string | undefined {
  const parts = FILTERS.filter((f) => chosen.has(f.id)).map((f) =>
    f.label.toLowerCase(),
  );
  if (days.picked) parts.push(days.picked);
  if (query.trim()) parts.unshift(`“${query.trim()}”`);
  return parts.length > 0 ? parts.join(" · ") : undefined;
}
