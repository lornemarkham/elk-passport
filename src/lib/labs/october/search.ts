import type { Possibility } from "./possibility";

/**
 * **One search box over everything, including the words nobody typed.**
 *
 * Two searches have to work for this to be worth having, and they fail in
 * different ways.
 *
 * `pumpkin` fails as a title search because the best answers do not say
 * pumpkin in their titles — a farm's name is a family's surname, and the word
 * only appears in Atlas's description. So the index is the whole of what is
 * written about a thing, not its name.
 *
 * `scary` fails as a text search because almost nothing in this corpus
 * describes itself as scary. Haunts say *haunted*, films are authored with a
 * `fear` level, and a night trail says nothing at all but is classified
 * `outdoor-night`. So a handful of words are expanded into the vocabulary the
 * evidence actually uses, and the expansion is a small authored table rather
 * than a model — it is readable, arguable and wrong in ways somebody can see.
 *
 * ## What this is not
 *
 * No index, no stemming beyond a prefix match, no ranking theory. It is a
 * linear scan over a few hundred possibilities, which is the right amount of
 * engineering for a prototype whose job is to answer *should this exist* and
 * not *how fast can it be*.
 */

/**
 * Words a person types, mapped to the vocabulary the corpus holds.
 *
 * Each entry is a claim somebody can check. `scary` reaches `haunt` because
 * haunted houses are what scary means in this corpus in October, and it
 * reaches `fear-creepy` and `fear-nightmare` because those are the two
 * authored levels of the film catalogue that genuinely qualify — `spooky` is
 * not scary and including it would make the search useless by agreeing with
 * everything.
 */
const MEANS: Readonly<Record<string, readonly string[]>> = {
  scary: [
    "haunt",
    "haunted",
    "horror",
    "fright",
    "terror",
    "scream",
    "ghost",
    "fear-creepy",
    "fear-nightmare",
    "outdoor-night",
  ],
  spooky: ["haunt", "ghost", "spooky", "fear-spooky", "fear-creepy"],
  pumpkin: ["pumpkin", "jack-o", "patch", "squash", "gourd", "carve"],
  kids: ["with-kids", "family", "children", "kid"],
  family: ["with-kids", "family", "children"],
  cosy: ["fear-cozy", "stay-in", "make"],
  cozy: ["fear-cozy", "stay-in", "make"],
  stars: ["astronomy", "meteor", "sky", "draconid", "telescope"],
  astronomy: ["astronomy", "meteor", "sky", "draconid", "telescope"],
  outside: ["outdoor-day", "outdoor-night", "farm", "trail", "walk"],
  indoors: ["indoor", "stay-in"],
  indoor: ["indoor", "stay-in"],
  costume: ["costume", "dress", "be-something"],
  farm: ["farm", "patch", "orchard", "ranch", "corn"],
  music: ["music", "band", "concert", "live"],
  film: ["movie", "film", "watch"],
  movie: ["movie", "film", "watch"],
  make: ["make", "making", "craft", "carve", "build"],
  tonight: [],
};

const STOP = new Set([
  "a",
  "an",
  "the",
  "to",
  "for",
  "of",
  "in",
  "on",
  "and",
  "or",
  "me",
  "my",
  "i",
  "something",
  "some",
  "with",
  "do",
  "want",
  "is",
  "it",
]);

/** The words a query actually searches for, after expansion. */
export function termsOf(query: string): readonly string[] {
  const typed = query
    .toLowerCase()
    .split(/[^a-z0-9'-]+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 1 && !STOP.has(w));

  const out = new Set<string>();
  for (const word of typed) {
    out.add(word);
    // **A typed plural has to reach a singular record.** Atlas holds the
    // shower as "Draconid meteor shower 2026", and prefix matching only grows
    // a word — so somebody typing "draconids", which is what everybody calls
    // them, found nothing at all. The singular is added as well as the plural,
    // never instead of it.
    if (word.length > 4 && word.endsWith("s")) {
      out.add(word.endsWith("es") ? word.slice(0, -2) : word.slice(0, -1));
    }
    for (const extra of MEANS[word] ?? []) out.add(extra);
  }
  return [...out];
}

export interface Hit {
  readonly possibility: Possibility;
  readonly score: number;
  /** The terms that actually matched, for the surface to show its working. */
  readonly on: readonly string[];
}

/**
 * Rank possibilities against a query.
 *
 * A title hit outweighs a tag hit outweighs a body hit, because somebody
 * typing "Field of Screams" wants Field of Screams and not the six other
 * things whose descriptions mention screaming. Matching is prefix-based on
 * word boundaries, which is what makes "carve" find "carving" without any
 * stemmer and without "scar" finding "scare".
 */
export function search(
  possibilities: readonly Possibility[],
  query: string,
  limit = 24,
): readonly Hit[] {
  const terms = termsOf(query);
  if (terms.length === 0) return [];

  const hits: Hit[] = [];
  for (const p of possibilities) {
    const title = p.title.toLowerCase();
    const tags = p.tags.join(" ").toLowerCase();
    let score = 0;
    const on: string[] = [];

    for (const term of terms) {
      let matched = false;
      // A title or a tag is short and curated, so a prefix match is safe and
      // useful: "carve" should find "Carve pumpkins", "haunt" should find
      // "Haunted Halloween Trail".
      if (loose(term).test(title)) {
        score += 6;
        matched = true;
      }
      if (loose(term).test(tags)) {
        score += 3;
        matched = true;
      }
      // A description is long prose, where a prefix match is how "corn maze"
      // returns "Web a corner of a room" — found by running that exact search.
      // So the body is matched on the whole word, give or take a plural.
      if (tight(term).test(p.text)) {
        score += 1;
        matched = true;
      }
      if (matched) on.push(term);
    }

    if (score === 0) continue;
    // Something available tonight edges ahead of something identical that is
    // not, because the question behind every search here is still "tonight?".
    if (p.availability.tonight) score += 1;
    hits.push({ possibility: p, score, on });
  }

  return hits
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.possibility.title.localeCompare(b.possibility.title),
    )
    .slice(0, limit);
}

/** Prefix match on a word boundary: `haunt` finds `haunted`. */
const loose = (term: string) => new RegExp(`(^|[^a-z0-9])${escape(term)}`, "i");

/** Whole word, plural tolerated: `corn` does not find `corner`. */
const tight = (term: string) =>
  new RegExp(`(^|[^a-z0-9])${escape(term)}(e?s)?([^a-z0-9]|$)`, "i");

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
