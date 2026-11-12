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

/**
 * **The pool as `/go` sends it to the browser** — the same places, without the
 * two things the day never reads there and which were a third of the page:
 * Atlas's `presentationImage` (the day shows `heroMedia`; the licence, source
 * and caption of a category picture were 4.3 MB of the 19 MB `/go` sent,
 * measured on production 2026-11-12) and `geography.evidence`, the records
 * behind a position that nothing in the product UI reads (1.1 MB). Everything
 * `buildDay`, the plan and the paper read — coordinates, locality, area,
 * schedule statements, environment, knowledge — is kept.
 *
 * Only for what is serialised. Server-side readers (`/go/print`, proposals)
 * keep the whole `dayPool`.
 */
export function forTheBrowser(pool: readonly Experience[]): Experience[] {
  return pool.map((e) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { presentationImage, geography, ...rest } = e;
    if (!geography) return rest;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { evidence, ...place } = geography;
    return { ...rest, geography: place };
  });
}
