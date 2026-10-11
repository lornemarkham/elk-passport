/**
 * **The `/go/print` query is Passport's day interchange format.** Nobody chose
 * that; it happened. Measured 2026-10-11 across every lane:
 *
 * - `GoHaveADay` writes it, `/go/print` reads it (main);
 * - lane `analog`'s printable and lane `maps`' travel captions re-read it;
 * - lane `detox` copies the print page's reader to build an offline day
 *   (`src/lib/detox/resolve.ts`, keys in `DAY_QUERY_KEYS`);
 * - lane `boards` stores it, canonicalised, as a shared plan
 *   (`passport_board_plans.day_query`, keys in `DAY_KEYS`, uncommitted);
 * - this lane's `print.ts` encodes an Adventure into it.
 *
 * Three lanes extend it. A consumer that whitelists the original six keys
 * drops the extensions without a word — a shared plan loses the minutes the
 * person set and the rain plan they picked. This registry is the list every
 * reader and writer should agree on; it changes no URL.
 */

export type DayQueryKey =
  | "stops"
  | "say"
  | "hours"
  | "age"
  | "at"
  | "on"
  | "b"
  | "mins"
  | "rain"
  | "by";

export interface DayQueryKeySpec {
  readonly key: DayQueryKey;
  readonly means: string;
  /** Where it is written today. `main` means merged. */
  readonly from: string;
}

export const DAY_QUERY: readonly DayQueryKeySpec[] = [
  {
    key: "stops",
    means: "Atlas subject ids, comma-separated, in order",
    from: "main",
  },
  { key: "say", means: "the sentence as typed", from: "main" },
  { key: "hours", means: "hours available, 0 < h ≤ 24", from: "main" },
  { key: "age", means: "one child's age, 0–17", from: "main" },
  { key: "at", means: "a DiscoveryTown id", from: "main" },
  { key: "on", means: "the day, YYYY-MM-DD", from: "main" },
  {
    key: "b",
    means: "the carried brief, JSON (party, start/home-by, avoid, cautions…)",
    from: "lane/daybuilder dcdabbf, src/domain/day/carry.ts",
  },
  {
    key: "mins",
    means: "minutes the person set, id:minutes,…",
    from: "lane/daybuilder dcdabbf",
  },
  {
    key: "rain",
    means: "chosen rain plans, id~altId,…",
    from: "lane/daybuilder dcdabbf",
  },
  {
    key: "by",
    means: "travel mode when not driving",
    from: "lane/maps d62ba73",
  },
];

/** The six keys every lane agrees on, because they are main's. */
export const CORE_DAY_QUERY_KEYS = DAY_QUERY.filter(
  (k) => k.from === "main",
).map((k) => k.key);

/**
 * What a reader that keeps only `kept` would silently drop from this query.
 * Empty means the day survives the trip.
 */
export function dayQueryLosses(
  query: URLSearchParams,
  kept: readonly string[],
): DayQueryKeySpec[] {
  return DAY_QUERY.filter(
    (spec) => query.has(spec.key) && !kept.includes(spec.key),
  );
}
