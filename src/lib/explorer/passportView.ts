import { candidateToExperience } from "@/domain/experience/atlasMapper";
import { destinationFor } from "@/domain/experience/destination";
import { feedExclusion } from "@/domain/discovery/defaultFeed";
import {
  matchesScope,
  type GeographicScope,
} from "@/domain/discovery/geographicScope";
import type { DiscoveryCandidate } from "@/lib/data/types";
import type { DiscoveryVerdict } from "@/lib/data/explorer-dossier-repo";

/**
 * **How Passport sees an entity — answered by Passport, next to Atlas's truth.**
 *
 * ## Why this is in Passport and not in the dossier
 *
 * The dossier says what Atlas holds. This says what Passport would do with
 * it, and the two must never be computed in the same place. Atlas holding a
 * copy of the feed policy is how the copy and the original quietly stop
 * agreeing — and then the diagnostic is worse than none, because it is
 * confidently wrong about the thing it exists to explain.
 *
 * So every answer below comes from the function that really decides it:
 * `feedExclusion` is the feed, `matchesScope` is the scope, `destinationFor`
 * is the link a card renders, `candidateToExperience` is the mapping. Nothing
 * here reimplements a rule; it runs them.
 *
 * ## The one thing Passport cannot answer
 *
 * *Is this a Discovery candidate at all?* is Atlas's decision, made in
 * `DiscoveryCandidates.suppressionReason`. So that answer is read from
 * `/discovery/candidates` — the same endpoint Discover itself consumes —
 * rather than recomputed. A suppressed entity never reaches Passport, which
 * is precisely why an inspection tool has to say so.
 *
 * The whole point is the chain: **suppressed → out of region → excluded by
 * the feed → shown but not clickable → shown.** An entity missing from
 * Discovery failed at exactly one of those, and until now finding out which
 * meant reading four files.
 */

export type VisibilityStage =
  "suppressed-by-atlas" | "outside-scope" | "excluded-from-feed" | "in-feed";

export interface PassportView {
  /** How far the entity gets down the Discovery pipeline. */
  readonly stage: VisibilityStage;
  /** One sentence naming the gate, in the words of whichever layer owns it. */
  readonly explanation: string;
  /** Atlas's own reason, when Atlas suppressed it before Passport ever saw it. */
  readonly suppressionReason?: string;
  /** The feed rule that excluded it, when the feed did. */
  readonly feedExclusion?: string;
  /** Region membership as the candidate carries it — empty is the common case. */
  readonly regionIds: readonly string[];
  readonly inScope: boolean;
  /** Whether Atlas holds the fields a Passport detail page renders. */
  readonly detailReady: boolean;
  /** Where a Discovery card would send a traveller, or `undefined` for a dead card. */
  readonly destination?: string;
  /** Present only when Atlas offered this entity to Discovery at all. */
  readonly candidate?: DiscoveryCandidate;
}

/**
 * Run the real pipeline over one entity.
 *
 * `scope` is whatever `activeScope()` resolved — `undefined` means Passport
 * is looking everywhere, which is a legitimate state and not an error.
 */
export function passportView(
  verdict: DiscoveryVerdict,
  scope: GeographicScope | undefined,
): PassportView {
  if (verdict.suppressed) {
    return {
      stage: "suppressed-by-atlas",
      explanation:
        "Atlas does not offer this to Discovery at all, so no Passport policy ever runs on it.",
      suppressionReason: verdict.suppressed.reason,
      regionIds: [],
      inScope: false,
      detailReady: false,
    };
  }

  if (!verdict.candidate) {
    return {
      stage: "suppressed-by-atlas",
      explanation:
        "Atlas's discovery projection contains neither a candidate nor a suppression for this id — it is not an entity Discovery considers.",
      regionIds: [],
      inScope: false,
      detailReady: false,
    };
  }

  const candidate = verdict.candidate as DiscoveryCandidate;
  const experience = candidateToExperience(candidate);
  const inScope = matchesScope(experience, scope);
  const exclusion = feedExclusion(experience);
  const destination = destinationFor(experience);

  const shared = {
    regionIds: candidate.regionIds ?? [],
    inScope,
    detailReady: experience.detailReady ?? false,
    destination,
    candidate,
  };

  if (!inScope) {
    return {
      ...shared,
      stage: "outside-scope",
      explanation: scope
        ? `Atlas has not placed this in ${scope.label}, and a region scope excludes what it has not been told belongs — so Discovery never lists it.`
        : "Passport has no active scope, so this cannot be out of scope.",
      feedExclusion: exclusion,
    };
  }

  if (exclusion) {
    return {
      ...shared,
      stage: "excluded-from-feed",
      explanation: `In scope, but Passport's default feed excludes it (${exclusion}). It stays findable by search and by kind.`,
      feedExclusion: exclusion,
    };
  }

  return {
    ...shared,
    stage: "in-feed",
    explanation: destination
      ? "Shown in the default Discovery feed, and opening the card leads somewhere."
      : "Shown in the default Discovery feed, but no Passport page exists for it — the card renders without a link.",
  };
}

export const STAGE_LABEL: Record<VisibilityStage, string> = {
  "suppressed-by-atlas": "Suppressed by Atlas",
  "outside-scope": "Outside the active scope",
  "excluded-from-feed": "Excluded from the default feed",
  "in-feed": "In the Discovery feed",
};
