import type { AdventureSummary } from "@/lib/adventures/store";

/**
 * **Which of someone's own Christmas adventures lead.** Coming-up (or
 * undated) first, soonest first; finished ones — their last day before today —
 * apart. Two that are the same plan (same title, same days, same place) show
 * once: the newest-listed copy stays, the rest are counted, never deleted.
 */
export interface Mine {
  readonly upcoming: readonly AdventureSummary[];
  readonly past: readonly AdventureSummary[];
  /** Duplicates left out of both lists. */
  readonly hidden: number;
}

const sameness = (a: AdventureSummary) =>
  [
    a.title.trim().toLowerCase().replace(/\s+/g, " "),
    a.startsOn ?? "",
    a.endsOn ?? "",
    (a.destinationLabel ?? "").trim().toLowerCase(),
  ].join("|");

export function splitMine(
  all: readonly AdventureSummary[],
  today: string,
): Mine {
  const seen = new Set<string>();
  const once: AdventureSummary[] = [];
  for (const a of all) {
    const key = sameness(a);
    if (seen.has(key)) continue;
    seen.add(key);
    once.push(a);
  }
  const over = (a: AdventureSummary) => (a.endsOn ?? a.startsOn ?? "9") < today;
  const first = (a: AdventureSummary) => a.startsOn ?? "9999-12-31";
  const upcoming = once
    .filter((a) => !over(a))
    .sort((a, b) => first(a).localeCompare(first(b)));
  const past = once
    .filter(over)
    .sort((a, b) => first(b).localeCompare(first(a)));
  return { upcoming, past, hidden: all.length - once.length };
}
