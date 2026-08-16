/**
 * **The shared vocabulary for membership evidence — safe on both sides.**
 *
 * Deliberately has **no** `import "server-only"`. The scoring in
 * `membershipConfidence.ts` reads the whole workspace bundle and must stay
 * on the server; the *words* it produces — band names, signal shapes, the
 * thresholds — have to be readable by the client component that renders
 * them.
 *
 * Splitting them is not tidiness. Importing the server module from a
 * `"use client"` component compiles and typechecks cleanly and then throws
 * at request time:
 *
 * > *You're importing a module that depends on "server-only".*
 *
 * **A boundary violation that `tsc` and `eslint` both pass is only found by
 * loading the page.** That is the whole argument for verifying in the
 * browser rather than inferring from a green build.
 */

export type SignalClass = "documentary" | "corroborating" | "geometric";

export interface Signal {
  readonly id: string;
  readonly label: string;
  readonly cls: SignalClass;
  readonly weight: number;
  readonly present: boolean;
  /** Names the actual evidence when present, or what is missing when not. */
  readonly detail: string;
}

export type Band = "strong" | "moderate" | "weak" | "none";

/** Sum of every scoring signal's weight. Geometric signals contribute 0. */
export const MAX_SCORE = 9;

export const BAND_META: Readonly<
  Record<Band, { label: string; blurb: string; bulk: boolean }>
> = {
  strong: {
    label: "Strong documentary evidence",
    blurb:
      "More than one published page ties these to this region. This is the best evidence Atlas has — and it is still worth reading the row. A page about a member also describes its suppliers, its road contractor and the airport two valleys over. Atlas can tell you a source connects them; only you can say the entity belongs here.",
    bulk: true,
  },
  moderate: {
    label: "One published link",
    blurb:
      "A single page Atlas has read describes this entity and something already in the region. Real evidence, one direction only.",
    bulk: true,
  },
  weak: {
    label: "Indirect signals only",
    blurb:
      "Nothing published connects these to the region. What Atlas has is general — a well-sourced record, a known type, or a computed proximity link. Useful for deciding where to look next, not for placing.",
    bulk: false,
  },
  none: {
    label: "Atlas holds nothing",
    blurb:
      "No source, no relationship, no signal of any kind ties these to this region. That is not a judgement that they do not belong — it is Atlas saying plainly that it cannot help you decide, and that placing them is entirely your call.",
    bulk: false,
  },
};

/** Deterministic, and printed in the UI so a curator can check the maths. */
export const BAND_THRESHOLDS: readonly { band: Band; min: number }[] = [
  { band: "strong", min: 6 },
  { band: "moderate", min: 3 },
  { band: "weak", min: 1 },
  { band: "none", min: 0 },
];

export function bandFor(score: number): Band {
  for (const t of BAND_THRESHOLDS) if (score >= t.min) return t.band;
  return "none";
}

/**
 * **What Atlas would need before it could ever place an entity without
 * asking.**
 *
 * Written down so the bar is a published standard rather than a judgement
 * made later under pressure to make automation demo well. Every row is a
 * class of evidence Atlas does **not** hold today; the `have` flag exists
 * so the list stops being aspirational the moment ingestion delivers one.
 *
 * The ordering matters. The first two are *statements about membership*;
 * the rest are corroboration. **No quantity of corroboration substitutes
 * for one source that says where a place is** — which is the whole lesson
 * of the road contractor that scored full marks on shared-source evidence.
 */
export interface AutoApprovalRequirement {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
  /** Whether Atlas holds this class of evidence today. */
  readonly have: boolean;
}

export const AUTO_APPROVAL_REQUIREMENTS: readonly AutoApprovalRequirement[] = [
  {
    id: "region-statement",
    label: "A source that states the region outright",
    detail:
      'Extraction captures "X is in the Okanagan" as a claim, with the page that said it. This is the one requirement with no substitute.',
    have: false,
  },
  {
    id: "official-listing",
    label: "An official listing that defines its own catchment",
    detail:
      "A tourism body's member directory, a municipal register, or a park authority's site list. Membership of the list is itself the regional claim.",
    have: false,
  },
  {
    id: "official-address",
    label: "An address published by the operator",
    detail:
      "A municipality in an address the business itself published — not a geocoded guess, and not a third-party listing.",
    have: false,
  },
  {
    id: "independent-corroboration",
    label: "Two independent authoritative sources agreeing",
    detail:
      "Two publishers with no relationship to each other. Two pages on the same domain are one source wearing two hats.",
    have: false,
  },
  {
    id: "explicit-relationship",
    label: "An asserted containment path to the region",
    detail:
      "Already available and already honoured — an entity reachable from a member is in scope and never appears in this queue. Listed for completeness.",
    have: true,
  },
];
