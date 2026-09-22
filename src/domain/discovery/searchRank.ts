import type { Experience } from "@/domain/experience/types";

/**
 * **Deterministic name search.** (M10)
 *
 * Search used to be one substring test: the whole query, lower-cased, had to
 * appear contiguously in the title or description. "Knox Mountain Park" found
 * Knox Mountain Park; "Knox Mountain Park first" found nothing, and so did
 * "show me Knox Mountain Park" and "Mountain Knox Park". Measured over the
 * 314 searchable candidates: every name failed with one extra word, and
 * results came back in corpus order with no ranking at all.
 *
 * This ranks by how much of an entity's *name* the query accounts for — and
 * nothing else. There is no stopword list ("first", "show", "me" are harmless
 * because the name is fully present, not because a dictionary says so), no
 * edit distance, no synonyms, no category or place-type reading. Aliases
 * Atlas holds are alternative names and match exactly as the name does.
 *
 * Tiers, strongest first:
 *
 * - **T0 exact** — the normalised query is the normalised name or an alias.
 * - **T1 full name** — every token of the name is in the query (as a phrase
 *   or in any order) and the name explains at least half the query's
 *   tokens. Within the tier, a name with more tokens ranks first: for "Knox
 *   Mountain Park first", Knox Mountain Park (3 of 4) above Knox Mountain
 *   (2 of 4). The half rule keeps a town's name from topping every sentence
 *   that mentions it.
 * - **T2 prefix** — the query is the start of the name, token by token, the
 *   last query token allowed to be the start of its name token: "Kasugai",
 *   "Knox Mountain", "Kasugai Garden".
 * - **T3 weak name** — at least half the name's tokens, and at least two,
 *   are in the query. Where a typo lands, on the surviving exact tokens.
 * - **T4 description** — the query, as one string, inside the description.
 *   Exactly the old matcher, kept as the floor so nothing found before is
 *   lost.
 *
 * Measured before choosing the order of T3 and T4 on the frozen cohort:
 * weak-name hits ("Knox Mountian Park" → Knox Mountain Park) are the thing
 * the person typed; description hits are a mention. Weak name ranks above.
 *
 * Normalisation: lower-case, diacritics stripped (NFD), anything that is not
 * a letter or digit becomes a space, whitespace collapsed, then split.
 */

export type MatchTier = 0 | 1 | 2 | 3 | 4;

export interface QueryMatch {
  readonly tier: MatchTier;
  /** The name or alias that matched (T0–T3); absent for a description match. */
  readonly matchedName?: string;
  /** How many tokens the matched name has — the within-tier specificity. */
  readonly nameTokens: number;
  /** True when the match was on `title`, false when on an alias. */
  readonly primary: boolean;
}

export function normalizeForSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function searchTokens(text: string): string[] {
  const n = normalizeForSearch(text);
  return n ? n.split(" ") : [];
}

function matchName(
  name: string,
  primary: boolean,
  queryNorm: string,
  queryTokens: readonly string[],
): QueryMatch | undefined {
  const nameNorm = normalizeForSearch(name);
  if (!nameNorm) return undefined;
  const nameTokens = searchTokens(name);
  const base = { matchedName: name, nameTokens: nameTokens.length, primary };

  if (nameNorm === queryNorm) return { tier: 0, ...base };

  const explains = nameTokens.length / queryTokens.length >= 0.5;
  const phrase = ` ${queryNorm} `.includes(` ${nameNorm} `);
  const everyToken = nameTokens.every((t) => queryTokens.includes(t));
  if ((phrase || everyToken) && explains) return { tier: 1, ...base };

  const prefix =
    queryTokens.length <= nameTokens.length &&
    queryTokens.every((t, i) =>
      i === queryTokens.length - 1
        ? nameTokens[i]!.startsWith(t)
        : nameTokens[i] === t,
    );
  if (prefix) return { tier: 2, ...base };

  const matched = nameTokens.filter((t) => queryTokens.includes(t)).length;
  if (matched >= 2 && matched / nameTokens.length >= 0.5) {
    return { tier: 3, ...base };
  }
  // A full name that explains too little of the query is weak evidence too.
  if (phrase || everyToken) return { tier: 3, ...base };
  return undefined;
}

/**
 * The strongest way this experience matches the query, or `undefined` when it
 * does not. An empty query matches everything at the floor, so a list with
 * no query is the list unchanged.
 */
export function rankQuery(
  experience: Experience,
  query: string,
): QueryMatch | undefined {
  const queryNorm = normalizeForSearch(query);
  if (!queryNorm) return { tier: 4, nameTokens: 0, primary: true };
  const queryTokens = queryNorm.split(" ");

  let best: QueryMatch | undefined;
  const consider = (candidate: QueryMatch | undefined) => {
    if (candidate && (!best || better(candidate, best))) best = candidate;
  };
  consider(matchName(experience.title, true, queryNorm, queryTokens));
  for (const alias of experience.aliases ?? []) {
    consider(matchName(alias, false, queryNorm, queryTokens));
  }
  if (best) return best;

  // The old matcher, unchanged, as the floor.
  const haystack = [
    experience.title,
    experience.shortDescription,
    experience.description ?? "",
    ...experience.moods,
    ...experience.activities,
  ]
    .join(" ")
    .toLowerCase();
  if (haystack.includes(query.trim().toLowerCase())) {
    return { tier: 4, nameTokens: 0, primary: true };
  }
  return undefined;
}

/** Lower tier first; within T1 more name tokens first; the name over an alias when otherwise equal. */
function better(a: QueryMatch, b: QueryMatch): boolean {
  return compareMatches(a, b) < 0;
}

export function compareMatches(a: QueryMatch, b: QueryMatch): number {
  if (a.tier !== b.tier) return a.tier - b.tier;
  if (a.tier === 1 && a.nameTokens !== b.nameTokens) {
    return b.nameTokens - a.nameTokens;
  }
  if (a.primary !== b.primary) return a.primary ? -1 : 1;
  return 0;
}

/**
 * The experiences that match, best first. Order among equals is the order
 * they arrived in, so a list with no query keeps its shape and ties are
 * deterministic.
 */
export function rankByQuery(
  experiences: readonly Experience[],
  query: string,
): Experience[] {
  const ranked: { experience: Experience; match: QueryMatch; index: number }[] =
    [];
  experiences.forEach((experience, index) => {
    const match = rankQuery(experience, query);
    if (match) ranked.push({ experience, match, index });
  });
  ranked.sort(
    (a, b) =>
      compareMatches(a.match, b.match) ||
      (a.match.tier === 2
        ? a.experience.title.length - b.experience.title.length
        : 0) ||
      a.index - b.index,
  );
  return ranked.map((r) => r.experience);
}
