import type { DateNight } from "../types";
import { LORNE_AND_JESS } from "./lorne-and-jess";

/**
 * **Every Date Night Passport serves**, by slug.
 *
 * Today they are files, because the first one had to exist tonight. When
 * people make their own, this lookup is the seam that moves to Postgres; the
 * pages call `dateNight(slug)` and never import a night directly.
 */
const NIGHTS: readonly DateNight[] = [LORNE_AND_JESS];

export function dateNight(slug: string): DateNight | undefined {
  return NIGHTS.find((n) => n.slug === slug);
}

export function allDateNights(): readonly DateNight[] {
  return NIGHTS;
}
