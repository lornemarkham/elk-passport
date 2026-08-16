import "server-only";
import type { WorkspaceBundle } from "./workspaceData";

/**
 * **How much evidence Atlas holds that an entity belongs to a region — and
 * exactly which evidence.**
 *
 * Supersedes `membershipEvidence.ts`, which sorted candidates into three
 * flat tiers. Tiers answered *"is there evidence?"*. A curator facing 157
 * unplaced entities needs the harder answer: **which evidence, how much of
 * it, and what is missing.**
 *
 * ## The score is a count of evidence, not a probability
 *
 * `score` is the sum of the weights of the signals that are actually
 * present, out of `MAX_SCORE`. It is reproducible by hand from the list
 * this module returns, and it moves only when evidence moves.
 *
 * > **It is not a confidence percentage and must never be rendered as
 * > one.** "98% confident" claims Atlas has estimated the probability that
 * > a placement is correct. It has not, it cannot, and a number that looks
 * > like a probability will be trusted like one. What Atlas can say
 * > honestly is *"four of the six things I look for are true, here they
 * > are, and here are the two that are not."*
 *
 * ## Signal classes, and why the distinction is load-bearing
 *
 * - **`documentary`** — a real page said something. Someone published it,
 *   it is quotable, and it survives a curator asking "why?".
 * - **`corroborating`** — true of the entity but not *about* the region.
 *   Having three sources makes a record more trustworthy in general; it
 *   says nothing about the Okanagan. Scores low on purpose.
 * - **`geometric`** — derived from stored coordinates. **Scores zero,
 *   permanently.** `near` edges are computed by
 *   `computeNearRelationshipsCli`, not read from any source; letting one
 *   raise a membership score would be the coordinate inference ADR 025
 *   forbids, arriving through the graph instead of through a bounding box.
 *   It is shown, because it tells a curator where to look. It never counts.
 *
 * ## Why nothing is auto-asserted today
 *
 * `autoAssertable` exists, is computed, and is **false for every entity in
 * the current corpus**. That is a finding, not an oversight.
 *
 * Measured live on 2026-08-15 against the Okanagan: of 157 unplaced
 * entities, 32 have documentary evidence, 7 have only proximity, and 118
 * have nothing at all. The single highest-scoring candidate was **AIM
 * Roads** — a highway maintenance contractor that appears on Big White's
 * own directions page. Every documentary signal fires for it. It is
 * plainly not an Okanagan destination.
 *
 * > **A source that describes two things does not claim they are in the
 * > same region.** A page about a ski resort will also describe the road
 * > contractor, the shuttle company and the airport two valleys over.
 * > Shared-source evidence is strong enough to *rank* a queue and far too
 * > weak to *assert* membership.
 *
 * So auto-assertion is gated on a signal class Atlas does not yet produce:
 * a source that states regional membership outright. The gate is written
 * and wired; the evidence to open it has to be built in ingestion. Until
 * then the honest automation is not "place these without asking" — it is
 * "make placing 32 reviewed entities one click instead of thirty-two",
 * which is what the drawer does.
 */

export type { SignalClass, Signal, Band } from "./membershipBands";
export {
  MAX_SCORE,
  BAND_META,
  BAND_THRESHOLDS,
  bandFor,
} from "./membershipBands";

import {
  MAX_SCORE as MAX,
  bandFor,
  type Band,
  type Signal,
} from "./membershipBands";

export interface MembershipAssessment {
  readonly entityId: string;
  readonly band: Band;
  readonly score: number;
  readonly max: number;
  /** Every signal, present and absent — the checklist a curator reads. */
  readonly signals: readonly Signal[];
  /** One sentence: the strongest true thing Atlas can say. */
  readonly headline: string;
  /**
   * Whether Atlas may write this membership with no human review.
   * Always `false` today — see the module docstring.
   */
  readonly autoAssertable: boolean;
  readonly autoBlockedBecause: string;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/** Free-text subtype, whatever the source called it. Empty or "unknown" is untyped. */
function subtypeOf(entity: Record<string, unknown>): string {
  const raw =
    (entity.placeType as string | undefined) ??
    (entity.organizationType as string | undefined) ??
    (entity.activityType as string | undefined) ??
    "";
  const value = String(raw).trim().toLowerCase();
  return value === "unknown" ? "" : value;
}

export function assessMembership(
  scopeIds: ReadonlySet<string>,
  candidateIds: readonly string[],
  bundle: WorkspaceBundle | null,
): ReadonlyMap<string, MembershipAssessment> {
  const out = new Map<string, MembershipAssessment>();
  if (!bundle) return out;

  const byId = new Map(bundle.entities.map((e) => [String(e.id), e]));
  const nameById = new Map(
    bundle.entities.map((e) => [String(e.id), String(e.name)]),
  );
  const sourceById = new Map(bundle.sources.map((s) => [s.id, s]));

  // Which source records describe which entities.
  const sourcesOf = new Map<string, Set<string>>();
  for (const r of bundle.relationships) {
    if (r.type !== "describes" || !sourceById.has(r.sourceEntityId)) continue;
    const set = sourcesOf.get(r.targetEntityId);
    if (set) set.add(r.sourceEntityId);
    else sourcesOf.set(r.targetEntityId, new Set([r.sourceEntityId]));
  }

  // Every source describing a member, and which members it describes.
  const membersBySource = new Map<string, Set<string>>();
  for (const memberId of scopeIds) {
    for (const sourceId of sourcesOf.get(memberId) ?? []) {
      const set = membersBySource.get(sourceId);
      if (set) set.add(memberId);
      else membersBySource.set(sourceId, new Set([memberId]));
    }
  }

  // Official domains of current members, for the strongest documentary signal.
  const memberDomains = new Map<string, string>();
  for (const memberId of scopeIds) {
    const member = byId.get(memberId) as Record<string, unknown> | undefined;
    if (!member) continue;
    for (const key of ["website", "officialWebsite", "url", "homepage"]) {
      const value = member[key];
      if (typeof value === "string" && value) {
        const host = hostOf(value);
        if (host) memberDomains.set(host, memberId);
      }
    }
  }

  // `near` edges touching the region. Coordinate-derived — scores zero.
  const nearMember = new Map<string, string>();
  for (const r of bundle.relationships) {
    if (r.type !== "near") continue;
    if (scopeIds.has(r.sourceEntityId) && !scopeIds.has(r.targetEntityId)) {
      nearMember.set(r.targetEntityId, r.sourceEntityId);
    } else if (
      scopeIds.has(r.targetEntityId) &&
      !scopeIds.has(r.sourceEntityId)
    ) {
      nearMember.set(r.sourceEntityId, r.targetEntityId);
    }
  }

  for (const id of candidateIds) {
    const entity = byId.get(id) as Record<string, unknown> | undefined;
    const mySources = sourcesOf.get(id) ?? new Set<string>();

    // Which of this entity's sources also describe a region member?
    const linking: { sourceId: string; memberIds: Set<string> }[] = [];
    for (const sourceId of mySources) {
      const members = membersBySource.get(sourceId);
      if (members && members.size > 0)
        linking.push({ sourceId, memberIds: members });
    }

    const linkedMembers = new Set<string>();
    for (const l of linking) for (const m of l.memberIds) linkedMembers.add(m);

    const officialHit = linking.find((l) => {
      const src = sourceById.get(l.sourceId);
      return src ? memberDomains.has(hostOf(src.source)) : false;
    });

    const near = nearMember.get(id);
    const subtype = entity ? subtypeOf(entity) : "";

    const firstLink = linking[0];
    const firstMemberId = firstLink ? [...firstLink.memberIds][0] : undefined;

    const signals: Signal[] = [
      {
        id: "member-source",
        label: "A source describes this and something in the region",
        cls: "documentary",
        weight: 3,
        present: linking.length > 0,
        detail: firstLink
          ? `${sourceById.get(firstLink.sourceId)?.source ?? "A source Atlas holds"} also describes ${nameById.get(firstMemberId ?? "") ?? "a region member"}.`
          : "No page Atlas has read mentions this entity alongside anything in the region.",
      },
      {
        id: "official-domain",
        label: "That source is a region member's own website",
        cls: "documentary",
        weight: 2,
        present: Boolean(officialHit),
        detail: officialHit
          ? `Published on ${hostOf(sourceById.get(officialHit.sourceId)?.source ?? "")}, which is a member's official domain — the operator itself, not a third party.`
          : "The linking evidence, if any, is not from a member's own site.",
      },
      {
        id: "multi-link",
        label: "Linked to more than one entity in the region",
        cls: "documentary",
        weight: 2,
        present: linkedMembers.size > 1,
        detail:
          linkedMembers.size > 1
            ? `Sources tie it to ${linkedMembers.size} separate entities already in the region.`
            : "Only one region entity is connected, so the evidence points one direction.",
      },
      {
        id: "well-sourced",
        label: "Atlas holds more than one source for it",
        cls: "corroborating",
        weight: 1,
        present: mySources.size > 1,
        detail:
          mySources.size > 1
            ? `${mySources.size} sources describe this entity — a more trustworthy record, though not evidence about the region.`
            : "One source or fewer. Says nothing about the region either way.",
      },
      {
        id: "typed",
        label: "Has a concrete type",
        cls: "corroborating",
        weight: 1,
        present: subtype.length > 0,
        detail: subtype
          ? `Recorded as "${subtype}", so it is a real thing rather than an unclassified record.`
          : "No type recorded, so Atlas cannot even say what kind of thing this is.",
      },
      {
        id: "proximity",
        label: "Near something in the region",
        cls: "geometric",
        weight: 0,
        present: Boolean(near),
        detail: near
          ? `Atlas computed a "near" link to ${nameById.get(near) ?? "a region entity"} from stored coordinates. Nothing published said they belong together, so this deliberately adds nothing to the score.`
          : "No computed proximity link. Would not have counted anyway.",
      },
    ];

    const score = signals.reduce(
      (total, s) => total + (s.present ? s.weight : 0),
      0,
    );
    const band = bandFor(score);

    const headline = officialHit
      ? `A region member's own website describes this entity.`
      : linking.length > 0
        ? `${sourceById.get(firstLink!.sourceId)?.source ?? "A source"} describes this and ${nameById.get(firstMemberId ?? "") ?? "a region member"}.`
        : near
          ? `Only a computed proximity link — no source connects it to the region.`
          : `Nothing Atlas holds connects this entity to the region.`;

    out.set(id, {
      entityId: id,
      band,
      score,
      max: MAX,
      signals,
      headline,
      // No signal class in this corpus asserts membership outright, so the
      // gate never opens. Deliberate — see the module docstring.
      autoAssertable: false,
      autoBlockedBecause:
        "No source Atlas holds states which region this belongs to. Shared-source evidence ranks a queue; it cannot assert membership.",
    });
  }

  return out;
}
