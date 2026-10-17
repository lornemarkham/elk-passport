import type { Experience } from "@/domain/experience/types";
import {
  compareMatches,
  normalizeForSearch,
  rankQuery,
} from "@/domain/discovery/searchRank";

/**
 * **A place said by name, found in the one box.**
 *
 * Discovery used to have two text boxes: the sentence at the top, and a name
 * search above the results. People could not tell which one to use, and the
 * name search was the only route to "Davison Orchards" — the sentence reader
 * hears nothing in a proper noun, and hears "Kangaroo Creek Farm" as *farms*.
 * So the sentence box now does both: whatever the sentence was read as, a
 * place whose name it says comes first.
 *
 * The rule is `searchRank`'s, unchanged — names and aliases Atlas holds, no
 * synonyms, no guessing. Only the name tiers count (exact, full name, prefix)
 * when the sentence also said something Passport could act on, so "something
 * fun near Vernon" does not lead with a place called Vernon. When nothing else
 * was read, a weak name match and a description that mentions the words count
 * too — that was the old search box's floor, and it is kept so nothing it
 * found is lost.
 */
export interface NamedPick {
  readonly experience: Experience;
  /** Why it is here, said as a fact. */
  readonly reason: string;
}

/** How many name matches lead an answer. */
export const NAMED_MAX = 6;

export function findByName(
  pool: readonly Experience[],
  said: string,
  options: {
    /** True when the sentence was read as nothing else. */
    readonly loose: boolean;
  },
): NamedPick[] {
  const words = said.trim();
  if (words.length < 3) return [];
  const strongest = options.loose ? 4 : 2;
  const found: {
    experience: Experience;
    match: NonNullable<ReturnType<typeof rankQuery>>;
    index: number;
  }[] = [];
  // **A whole name said inside a sentence.** `searchRank` demotes a full name
  // that explains less than half the query (so a town's name does not top
  // every sentence that mentions it); in a sentence, "Kalamoir Park with the
  // kids" is still the park. A name of two words or more, said as a phrase,
  // counts — never a one-word name, which is how "near Vernon" would lead
  // with something called Vernon.
  const saidNorm = ` ${normalizeForSearch(words)} `;
  const saidWhole = (name: string | undefined) => {
    const n = name ? normalizeForSearch(name) : "";
    return n.split(" ").length >= 2 && saidNorm.includes(` ${n} `);
  };
  pool.forEach((experience, index) => {
    const match = rankQuery(experience, words);
    if (!match) return;
    if (
      match.tier <= strongest ||
      (match.tier === 3 && saidWhole(match.matchedName))
    )
      found.push({ experience, match, index });
  });
  found.sort((a, b) => compareMatches(a.match, b.match) || a.index - b.index);
  const seen = new Set<string>();
  const out: NamedPick[] = [];
  for (const { experience, match } of found) {
    if (seen.has(experience.id)) continue;
    seen.add(experience.id);
    out.push({
      experience,
      reason:
        match.tier === 4
          ? `Its description mentions “${words}”`
          : match.primary
            ? "The name you said"
            : `Also known as ${match.matchedName}`,
    });
    if (out.length >= NAMED_MAX) break;
  }
  return out;
}
