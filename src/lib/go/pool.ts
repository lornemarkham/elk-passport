import type { DiscoveryCandidate } from "@/lib/data/types";
import type { Experience } from "@/domain/experience/types";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import { defaultFeed } from "@/domain/discovery/defaultFeed";

/**
 * **What a day is chosen from**, one policy for `/go` and for the paper.
 *
 * The same feed policy Discovery applies — a typo'd parking lot is not a
 * stop on anybody's afternoon — plus anything the person chose (`chosen`)
 * that the policy leaves out: an Activity found by search is still somebody's
 * choice. A description that only repeats the short one is dropped, because
 * `/go` serialises this pool to the browser.
 *
 * `/go/print` judges "what is missing" against this same set
 * (`buildDay`'s `catalogue`), so the paper says what the screen said.
 */
export function dayPool(
  candidates: readonly DiscoveryCandidate[],
  chosen: readonly string[],
): Experience[] {
  const all = candidates.map(candidateToExperience);
  const feed = defaultFeed(all);
  const extra = all.filter(
    (e) => chosen.includes(e.id) && !feed.some((f) => f.id === e.id),
  );
  return [...feed, ...extra].map((e) =>
    e.description === e.shortDescription
      ? ({ ...e, description: undefined } as typeof e)
      : e,
  );
}
