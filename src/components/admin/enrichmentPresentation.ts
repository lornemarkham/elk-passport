import type { FieldOrigin } from "@/lib/data/explorer-repo";

/**
 * Presentation-only helpers for the enrichment review UI. Deliberately
 * simple, transparent heuristics — keyword matching and value comparisons
 * on real data already in hand — never a new AI call and never a claim
 * Atlas can't actually back up. "Longer" was rejected as a quality signal
 * on purpose (length isn't quality); this is what replaced it: naming
 * what kind of knowledge appears to be new, and whether independent
 * sources actually agree, not how much text there is.
 */

const CATEGORY_KEYWORDS: Record<string, RegExp> = {
  history:
    /\b(founded|built|established|history|historic|heritage|originally|century|18\d{2}|19\d{2})\b/i,
  "regional context":
    /\b(region|located|near|north of|south of|east of|west of|adjacent|borders?|within|outside)\b/i,
  activities:
    /\b(hik(e|ing)|ski(ing)?|boat(ing)?|swim(ming)?|fish(ing)?|camp(ing)?|tours?|trails?|golf(ing)?|bik(e|ing)|paddl(e|ing)|birdwatch(ing)?)\b/i,
  "access information":
    /\b(access(ible)?|road|parking|entrance|reachable|drive|highway|trailhead)\b/i,
  "seasonal information":
    /\b(summer|winter|spring|fall|autumn|season(al)?|year-round|closed|open(s)? (in|from))\b/i,
  "population and statistics":
    /\b(population|residents|people|km2|km²|square (kilomet|mile)|hectares?|acres?|elevation|metres|meters|feet)\b/i,
};

/**
 * What kind of knowledge the proposed text appears to introduce that the
 * current text doesn't — a keyword match, not a judgment of quality. A
 * category can appear here even if the proposed text is *shorter* than
 * the current one; that's the point of not using length as the signal.
 */
export function detectAddedCategories(
  currentValue: unknown,
  proposedValue: unknown,
): string[] {
  if (typeof proposedValue !== "string") return [];
  const current = typeof currentValue === "string" ? currentValue : "";

  const added: string[] = [];
  for (const [category, pattern] of Object.entries(CATEGORY_KEYWORDS)) {
    const inProposed = pattern.test(proposedValue);
    const inCurrent = pattern.test(current);
    if (inProposed && !inCurrent) added.push(category);
  }
  return added;
}

function joinWithAnd(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

/**
 * For fields that are never prose (a boolean, a confirmed-activities list),
 * keyword category-detection doesn't apply — it was built to sniff kinds of
 * knowledge out of free text. This names the kind of knowledge directly
 * instead, honestly (naming the category, never a quality claim). Same
 * extensibility pattern as `SOURCE_TYPE_LABELS`: a new structured field
 * needs a row here for a real why-sentence, not a UI change.
 */
const STRUCTURED_FIELD_KNOWLEDGE_LABELS: Record<string, string> = {
  hasActiveFireBan: "current fire-ban status",
  activities: "confirmed activities",
};

/**
 * One sentence explaining *why*, not a badge plus a category label plus a
 * source line. Image fields get their own honest framing — see
 * `imageRelevanceSentence` — since "adds regional context" makes no sense
 * for a photo.
 */
export function describeChange(
  field: string,
  currentValue: unknown,
  proposedValue: unknown,
): string {
  const gap = isGapFill(currentValue);
  if (field === "imageUrl") {
    return gap
      ? "No photo is currently stored."
      : "A different photo is available from another linked source.";
  }
  const base = gap ? "Fills a gap" : "Replaces the current value";
  const knowledgeLabel = STRUCTURED_FIELD_KNOWLEDGE_LABELS[field];
  if (knowledgeLabel) return `${base} — provides ${knowledgeLabel}.`;
  const categories = detectAddedCategories(currentValue, proposedValue);
  if (categories.length === 0) return `${base}.`;
  return `${base} — adds ${joinWithAnd(categories)}.`;
}

/**
 * The concrete answer to "what did this source contribute that another
 * didn't" — generic and source-agnostic by construction: it reads whichever
 * source types actually proposed or currently hold a value for this field,
 * and never hardcodes a source name. Reads as "Only BC Parks reports this"
 * today because BC Parks is the only source that does; it would read
 * differently for a different field or a future third source without any
 * change here. Returns "" when nothing honest can be said (e.g. the current
 * value's source can't be determined, or more than one source already
 * contributes to this field) — an empty contrast is not filled with a
 * guess.
 */
export function sourceContrastNote<T extends FieldRecommendationLike>(
  rec: FieldRecommendation<T>,
  currentOrigin: FieldOrigin | undefined,
): string {
  const proposalSourceTypes = new Set([
    rec.recommended.sourceType,
    ...rec.alternates.map((a) => a.sourceType),
  ]);

  if (isGapFill(rec.recommended.currentValue)) {
    if (proposalSourceTypes.size === 1) {
      return `Only ${sourceTypeLabel(rec.recommended.sourceType)} reports this — no other linked source does.`;
    }
    return "";
  }

  if (
    currentOrigin &&
    currentOrigin.sourceType !== rec.recommended.sourceType &&
    !proposalSourceTypes.has(currentOrigin.sourceType)
  ) {
    return `${sourceTypeLabel(currentOrigin.sourceType)} doesn't report this; ${sourceTypeLabel(rec.recommended.sourceType)} does.`;
  }

  return "";
}

/** Honest, source-relevance framing for an image proposal — not a quality judgment Atlas can't back up yet. */
export function imageRelevanceSentence(
  currentOrigin: FieldOrigin | undefined,
  proposedSourceType: string,
): string {
  const currentPart = currentOrigin
    ? `Current photo is from ${sourceTypeLabel(currentOrigin.sourceType)}`
    : "Current photo's original source could not be determined";
  return `${currentPart}; recommended photo is from ${sourceTypeLabel(proposedSourceType)}.`;
}

const SOURCE_TYPE_LABELS: Record<string, string> = {
  wikipedia: "Wikipedia",
  "passport-editorial": "Curator edit",
  bcparks: "BC Parks",
  destinationbc: "Destination BC",
  "passport-local-knowledge": "Passport Local Knowledge",
  // Missing until Phase 6.1 final cleanup — without this row the generic
  // fallback below renders "Osm" (naive title-casing of one lowercase
  // word), not the real name of the source, everywhere a source badge is
  // shown (Content Explorer's Sources list and the Enrichment panel's
  // "Currently stored" / "Recommended" badges both use this function).
  osm: "OpenStreetMap",
};

/** Falls back to a readable title-case version of the raw type for anything not in the table yet — a new source type needs a row here for a nice label, not a UI change. */
export function sourceTypeLabel(sourceType: string): string {
  return (
    SOURCE_TYPE_LABELS[sourceType] ??
    sourceType.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export type ConfidenceLevel = "low" | "medium" | "high" | "unscored";

export function confidenceLevel(
  confidence: number | undefined,
): ConfidenceLevel {
  if (confidence === undefined) return "unscored";
  if (confidence >= 0.8) return "high";
  if (confidence >= 0.5) return "medium";
  return "low";
}

/** A proposal is strictly additive — never a judgment call — when nothing is currently stored for that field. Drives the smart default: pre-select these, leave replacements for deliberate review. */
export function isGapFill(currentValue: unknown): boolean {
  if (currentValue === undefined || currentValue === null) return true;
  if (
    typeof currentValue === "string" &&
    (currentValue.trim() === "" ||
      currentValue.trim().toLowerCase() === "unknown")
  ) {
    return true;
  }
  if (Array.isArray(currentValue) && currentValue.length === 0) return true;
  return false;
}

export interface FieldRecommendationLike {
  field: string;
  currentValue: unknown;
  proposedValue: unknown;
  sourceRecordId: string;
  sourceLabel: string;
  sourceType: string;
  confidence?: number;
}

export interface FieldRecommendation<T extends FieldRecommendationLike> {
  field: string;
  /** The one candidate the curator actually reviews and can adopt. */
  recommended: T;
  /** Every other source's proposal for this same field — never hidden, just secondary. Ranking picks among values real sources actually produced; nothing here is authored or blended. */
  alternates: T[];
}

/**
 * A pluggable ranking signal — given one candidate, return a number,
 * higher wins. `groupAndRank` doesn't know or care what the number means;
 * that's deliberate. Today the only signal that exists is extraction
 * confidence, which is genuinely the right (and only available) one while
 * every proposal comes from the same source family. It will not stay the
 * only one: source trustworthiness, source freshness, corroboration
 * across multiple sources, local verification, completeness, editorial
 * approval, and eventually persona relevance are all real future ranking
 * signals, none of which exist yet. When one does, it becomes a new
 * `RankingSignal` (or a composite of several) passed into `groupAndRank`
 * — that function's own logic never needs to change to add one.
 */
export type RankingSignal<T extends FieldRecommendationLike> = (
  proposal: T,
) => number;

/** The only ranking signal that exists today. Not the long-term decision engine — see `RankingSignal`'s own doc comment. */
export function confidenceOnly<T extends FieldRecommendationLike>(
  proposal: T,
): number {
  return proposal.confidence ?? 0;
}

/**
 * One card per field, not one per source-proposal. The highest-scoring
 * real candidate (by `score`, confidence-only by default today) becomes
 * the recommendation; everything else in that field's group stays visible
 * as supporting evidence underneath it. This is selection among values
 * that already exist, not synthesis of a new one — nothing is combined,
 * rewritten, or invented here.
 */
export function groupAndRank<T extends FieldRecommendationLike>(
  proposals: readonly T[],
  score: RankingSignal<T> = confidenceOnly,
): FieldRecommendation<T>[] {
  const byField = new Map<string, T[]>();
  for (const proposal of proposals) {
    const group = byField.get(proposal.field) ?? [];
    group.push(proposal);
    byField.set(proposal.field, group);
  }

  const recommendations: FieldRecommendation<T>[] = [];
  for (const [field, group] of byField) {
    const ranked = [...group].sort((a, b) => score(b) - score(a));
    const [recommended, ...alternates] = ranked;
    recommendations.push({ field, recommended: recommended as T, alternates });
  }
  return recommendations;
}

export interface AgreementSummary<T extends FieldRecommendationLike> {
  totalSources: number;
  agreeingSources: number;
  allAgree: boolean;
  hasDisagreement: boolean;
  /** Distinct proposed values other than the recommendation, deduped — the actual disagreement, not just a count of it. */
  disagreeingValues: {
    value: unknown;
    sourceLabel: string;
    sourceType: string;
  }[];
}

/**
 * Whether independent sources actually agree — a stronger, faster-to-scan
 * trust signal than any single confidence percentage. Deliberately makes
 * no assumption about how many sources exist or what kind they are; this
 * reads the same whether there are 2 sources or 20, all Wikipedia or a
 * genuine mix.
 */
export function summarizeAgreement<T extends FieldRecommendationLike>(
  rec: FieldRecommendation<T>,
): AgreementSummary<T> {
  const all = [rec.recommended, ...rec.alternates];
  const recommendedKey = JSON.stringify(rec.recommended.proposedValue);

  const disagreeingValues: AgreementSummary<T>["disagreeingValues"] = [];
  const seen = new Set<string>();
  let agreeingSources = 0;

  for (const proposal of all) {
    const key = JSON.stringify(proposal.proposedValue);
    if (key === recommendedKey) {
      agreeingSources += 1;
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    disagreeingValues.push({
      value: proposal.proposedValue,
      sourceLabel: proposal.sourceLabel,
      sourceType: proposal.sourceType,
    });
  }

  return {
    totalSources: all.length,
    agreeingSources,
    allAgree: disagreeingValues.length === 0,
    hasDisagreement: disagreeingValues.length > 0,
    disagreeingValues,
  };
}
