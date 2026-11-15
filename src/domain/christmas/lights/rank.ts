import type { PinView } from "./model";

/**
 * **Ranking displays fairly** (Lights Map 2.0). A display's place in a list
 * is its stars shrunk towards the map's own average by how few people gave
 * them — a Bayesian average — so one five-star rating does not beat thirty
 * four-and-a-halfs, and a much-loved display is not buried by a single
 * grump. The prior is for ordering only: the number shown is always the
 * real mean of real ratings, with how many there are. No rating is ever
 * made up; a display nobody has rated is "not rated yet".
 */

/** How many imagined average ratings each display starts with. */
export const PRIOR_WEIGHT = 4;
/** The prior when the map has too few ratings to have an average of its own. */
export const PRIOR_MEAN = 3.5;

export function priorMean(views: readonly PinView[]): number {
  let n = 0;
  let sum = 0;
  for (const v of views)
    if (v.rating) {
      n += v.rating.count;
      sum += v.rating.mean * v.rating.count;
    }
  return n >= 10 ? sum / n : PRIOR_MEAN;
}

/** The display's ranking score: its mean, shrunk towards the prior by volume. */
export function fairScore(
  rating: PinView["rating"],
  prior = PRIOR_MEAN,
): number {
  if (!rating) return prior;
  return (
    (PRIOR_WEIGHT * prior + rating.mean * rating.count) /
    (PRIOR_WEIGHT + rating.count)
  );
}

/** Rated well by enough people: drawn ⭐ on the map. */
export function isFavourite(v: PinView, prior = PRIOR_MEAN): boolean {
  if (v.rating && v.rating.count >= 3 && fairScore(v.rating, prior) >= 4)
    return true;
  return v.total >= 5;
}

/** Loved by the few who found it: rated 4.5 or better by one to four people. */
export function isHiddenGem(v: PinView): boolean {
  return (
    !!v.rating &&
    v.rating.count >= 1 &&
    v.rating.count <= 4 &&
    v.rating.mean >= 4.5 &&
    v.total < 5
  );
}

/** Rated displays, best first. Unrated ones are never listed as "best". */
export function bestOf(
  views: readonly PinView[],
  keep: (v: PinView) => boolean,
  n = 5,
  prior = priorMean(views),
): PinView[] {
  return views
    .filter((v) => v.status === "approved" && v.rating && keep(v))
    .sort(
      (a, b) =>
        fairScore(b.rating, prior) - fairScore(a.rating, prior) ||
        b.rating!.count - a.rating!.count ||
        a.name.localeCompare(b.name),
    )
    .slice(0, n);
}
