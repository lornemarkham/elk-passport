/**
 * Shared presentation rules for the Completeness / Knowledge Score —
 * one definition of "what does 82% mean," reused everywhere a score
 * appears (Content Explorer's entity panel, the Curator Queue, Atlas
 * Knowledge Health) instead of each view inventing its own thresholds.
 * Thresholds match `ContentHealthSummary`'s original `healthColor` (90 /
 * 70), carried forward rather than redefined.
 *
 * Sprint 2 Refinement: a real curator asked "what is a tier badge?" while
 * testing. The word "tier" itself never actually appeared as user-facing
 * text — every label already rendered as plain language ("Excellent",
 * "Good", "Needs Work") — but a bare word sitting next to a percentage,
 * with no explanation of what it means or where its boundaries are, reads
 * the same as unexplained jargon even when the word itself is plain
 * English. Two real fixes, both here: a fourth tier, `poor`, so a score
 * like Big White's ~13% reads as what it honestly is (not just "needs
 * work," a description that understates how little is there) — and
 * `SCORE_TIER_LEGEND`, a plain-language explanation of all four
 * boundaries, for any view to show inline rather than leaving a curator
 * to reverse-engineer the thresholds themselves.
 */

export type ScoreTier = "excellent" | "good" | "needs-work" | "poor";

export function scoreTier(percent: number): ScoreTier {
  if (percent >= 90) return "excellent";
  if (percent >= 70) return "good";
  if (percent >= 40) return "needs-work";
  return "poor";
}

export function scoreTierLabel(percent: number): string {
  switch (scoreTier(percent)) {
    case "excellent":
      return "Excellent";
    case "good":
      return "Good";
    case "needs-work":
      return "Needs Work";
    case "poor":
      return "Poor";
  }
}

export function scoreTextColor(percent: number | null): string {
  if (percent === null) return "text-foreground";
  switch (scoreTier(percent)) {
    case "excellent":
      return "text-green-600 dark:text-green-500";
    case "good":
      return "text-amber-600 dark:text-amber-500";
    case "needs-work":
      return "text-orange-600 dark:text-orange-500";
    case "poor":
      return "text-red-600 dark:text-red-500";
  }
}

export function scoreBarColor(percent: number): string {
  switch (scoreTier(percent)) {
    case "excellent":
      return "bg-green-600";
    case "good":
      return "bg-amber-500";
    case "needs-work":
      return "bg-orange-500";
    case "poor":
      return "bg-red-500";
  }
}

export function scoreBadgeClasses(percent: number): string {
  switch (scoreTier(percent)) {
    case "excellent":
      return "border-green-600 text-green-700 dark:text-green-400";
    case "good":
      return "border-amber-500 text-amber-700 dark:text-amber-400";
    case "needs-work":
      return "border-orange-500 text-orange-700 dark:text-orange-400";
    case "poor":
      return "border-red-500 text-red-700 dark:text-red-400";
  }
}

/**
 * Plain-language boundaries, meant to be shown inline (a `title` tooltip,
 * a caption under a badge) anywhere a score label appears without room
 * for its own explanation — the direct answer to "what does 'Good' mean
 * here, and where's the line?"
 */
export const SCORE_TIER_LEGEND =
  "Excellent: 90% or higher. Good: 70–89%. Needs Work: 40–69%. Poor: under 40%.";
