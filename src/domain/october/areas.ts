import type { Experience } from "@/domain/experience/types";

/**
 * **The areas of October, and how honest each one currently is.**
 *
 * These are *surfaces*: ordinary, useful interfaces that can later hold a
 * moment or a scene. None of them is an experience, and the list is
 * deliberately not a catalogue of experiences — October should be able to
 * change what it does inside one of these without the navigation changing
 * shape underneath a person.
 *
 * ## Why `status` is part of the model rather than a decoration
 *
 * This skeleton mixes three different kinds of truth, and the mixture is the
 * point of the pass. A surface reading real Atlas entities is not the same
 * promise as one showing a shape we intend to build, and a person walking
 * through it has to be able to tell which is which without being told
 * afterwards. Carrying it in the data means no card can accidentally present
 * an intention as a fact.
 *
 * ```
 * live       reads real Atlas entities or real Passport state
 * prototype  real entities seen through a keyword lens, not curated knowledge
 * later      the place exists; nothing is behind it yet
 * ```
 *
 * ## The lens, and what it is not
 *
 * `terms` are matched in **Passport**, against names, descriptions and
 * subtypes that Atlas already publishes. Atlas has no notion of Halloween and
 * is not being given one — no ontology change, no October flag, no tagging
 * run. That means the matching is a lens and not knowledge: it finds
 * `Black Mountain Haunted House` because of its name, and it will also find
 * things that merely read as spooky. Presenting that as curation would be the
 * lie; presenting it as "what the corpus has that looks like this" is not.
 */

export type AreaStatus = "live" | "prototype" | "later";

export interface OctoberArea {
  readonly id: string;
  readonly label: string;
  /** One line, in the person's language, about what this is for. */
  readonly line: string;
  readonly status: AreaStatus;
  /**
   * Where this already lives, when it already lives somewhere. Absent means
   * the area's own surface under `/october/explore`.
   */
  readonly href?: string;
  /** Matched against Atlas names, descriptions and subtypes. */
  readonly terms?: readonly string[];
  /** Said plainly on the surface when there is nothing real behind it yet. */
  readonly nothingYet?: string;
  /**
   * An editorial collection whose stated membership is **authoritative** for
   * this area. Where one is named, the keyword lens stops deciding what a
   * traveller sees — it found Caravan Farm Theatre and missed the production
   * Caravan was staging, which is not a tuning problem.
   */
  readonly collectionSlug?: string;
}

export const OCTOBER_AREAS: readonly OctoberArea[] = [
  {
    id: "movies",
    label: "Movies",
    line: "Something to watch, and who it suits.",
    status: "live",
    href: "/october/movies",
  },
  {
    id: "events-haunts",
    label: "Events & Haunts",
    line: "What is actually on, and what is actually frightening.",
    status: "live",
    collectionSlug: "okanagan-halloween-2026",
    terms: [
      "haunt",
      "haunted",
      "ghost",
      "ghost tour",
      "spooky",
      "scare",
      "horror",
      "theatre",
      "festival",
    ],
  },
  {
    id: "pumpkin-day",
    label: "Pumpkin Day",
    line: "The farm, the patch, the maze, the long drive home.",
    status: "prototype",
    terms: ["pumpkin", "corn maze", "farm", "orchard", "harvest", "ranch"],
  },
  {
    id: "food-treats",
    label: "Food & Treats",
    line: "Cider, doughnuts, and something warm on the way back.",
    status: "prototype",
    terms: ["bakery", "cider", "chocolate", "donut", "doughnut", "candy"],
  },
  {
    id: "kids-october",
    label: "Kids October",
    line: "The version of tonight that works with small people.",
    status: "prototype",
    terms: ["family", "kids", "children", "playground", "petting"],
  },
  {
    id: "costumes",
    label: "Costumes",
    line: "What you are going to be.",
    status: "later",
    nothingYet:
      "Passport does not know anything about costumes yet. When it does, it will start here.",
  },
  {
    id: "decorating",
    label: "Decorating",
    line: "The front of the house, and how far you are taking it.",
    status: "later",
    nothingYet: "Nothing here yet. This is where the front porch will live.",
  },
  {
    id: "make-something",
    label: "Make Something",
    line: "Carve it, bake it, build it, print it.",
    status: "later",
    nothingYet: "Nothing here yet. Bring your own knife.",
  },
];

export const areaById = (id: string): OctoberArea | undefined =>
  OCTOBER_AREAS.find((a) => a.id === id);

/** Where a card for this area should send somebody. */
export const hrefForArea = (area: OctoberArea): string =>
  area.href ?? `/october/explore/${area.id}`;

/**
 * **Has this already happened?**
 *
 * The corpus holds real events from previous years — both Black Mountain
 * Haunted House occurrences are dated October 2025 — and a lens that matches
 * on words alone will happily present last year's as though you could go.
 * Nothing is invented and nothing is mutated: this reads the dates Atlas
 * already published and asks whether they are behind us.
 *
 * An event with no date is **not** expired. Absent is not past, and dropping
 * it would be inventing a fact about it.
 */
export function hasPassed(e: Experience, now: Date): boolean {
  const ends = e.endTime ?? e.startTime;
  if (!ends) return false;
  const at = new Date(ends);
  return !Number.isNaN(at.getTime()) && at.getTime() < now.getTime();
}

const haystack = (e: Experience): string =>
  `${e.title} ${e.subtype ?? ""} ${e.shortDescription} ${e.description ?? ""}`.toLowerCase();

/**
 * The corpus, seen through one area's terms.
 *
 * Anything already over is dropped first — see `hasPassed`. What remains is
 * scored rather than merely filtered, so a thing whose *name* carries the term
 * outranks one that mentions it in passing — `McMillan Farms` should come
 * before a café whose description happens to say "farm to table". Ties break
 * on having a photograph, because a surface of unillustrated rows reads as
 * broken even when every row is true.
 */
export function throughLens(
  experiences: readonly Experience[],
  area: OctoberArea,
  limit = 12,
  now: Date = new Date(),
): Experience[] {
  if (!area.terms || area.terms.length === 0) return [];
  const scored: { e: Experience; score: number }[] = [];
  for (const e of experiences) {
    // Something that finished last October is not on. It is still a real
    // entity and still reachable from Discover; it is simply not an answer to
    // "what could I do", which is the only question these surfaces ask.
    if (hasPassed(e, now)) continue;
    const title = e.title.toLowerCase();
    const all = haystack(e);
    let score = 0;
    for (const term of area.terms) {
      if (title.includes(term)) score += 3;
      else if (all.includes(term)) score += 1;
    }
    if (score > 0) scored.push({ e, score });
  }
  return scored
    .sort(
      (a, b) =>
        b.score - a.score ||
        Number(Boolean(b.e.heroMedia)) - Number(Boolean(a.e.heroMedia)) ||
        a.e.title.localeCompare(b.e.title),
    )
    .slice(0, limit)
    .map((s) => s.e);
}
