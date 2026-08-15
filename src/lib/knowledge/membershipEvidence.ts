import "server-only";
import type { WorkspaceBundle } from "./workspaceData";

/**
 * **What Atlas already knows that bears on region membership.**
 *
 * ## Atlas does the analysis; the curator makes the assertion
 *
 * Showing 158 unchecked rows is safe and lazy — it makes a person
 * reconstruct, by hand, connections Atlas already recorded. This groups
 * them by the evidence Atlas holds and **names that evidence**, so the
 * curator reviews a proposal instead of doing the search.
 *
 * Nothing here writes. Nothing is pre-selected. Membership is still one
 * explicit act (ADR 025).
 *
 * ## The tiers, and why they are ranked this way
 *
 * **`shared-source`** — a source record that describes a current member
 * *also* describes this entity. Someone published a page about both. That
 * is documentary evidence: it exists because a real page said so, and it
 * survives a curator asking "why?".
 *
 * **`proximity`** — a `near` edge links this entity to a member.
 *
 * > **This is coordinate evidence wearing a relationship's clothes.**
 * > `near` edges are *computed* from stored coordinates by
 * > `computeNearRelationshipsCli`, not read from any source. Treating one
 * > as membership would be exactly the coordinate inference ADR 025
 * > forbids, arriving through the graph instead of through a bounding box.
 *
 * So proximity is shown, labelled as derived, and **never offered for bulk
 * selection**. It is a hint about where to look, not a reason to place.
 *
 * **`none`** — Atlas holds nothing connecting this entity to the region.
 * Not a judgement that it does not belong; a statement that Atlas cannot
 * help, and the curator is on their own.
 *
 * ## What is deliberately absent
 *
 * No score, no percentage, no "confidence". The tiers are *kinds of
 * evidence*, and the UI prints the evidence itself — which member, which
 * source — so a curator can disagree with the grouping rather than with a
 * number they cannot check.
 */

export type EvidenceTier = "shared-source" | "proximity" | "none";

export interface MembershipEvidence {
  readonly tier: EvidenceTier;
  /** Plain sentence naming the actual evidence. Empty for `none`. */
  readonly because: string;
}

export function membershipEvidence(
  scopeIds: ReadonlySet<string>,
  candidateIds: readonly string[],
  bundle: WorkspaceBundle | null,
): ReadonlyMap<string, MembershipEvidence> {
  const out = new Map<string, MembershipEvidence>();
  if (!bundle) return out;

  const nameById = new Map(
    bundle.entities.map((e) => [String(e.id), String(e.name)]),
  );
  const sourceById = new Map(bundle.sources.map((s) => [s.id, s]));

  // Which source records describe which entities, and vice versa.
  const sourcesOf = new Map<string, Set<string>>();
  for (const r of bundle.relationships) {
    if (r.type !== "describes" || !sourceById.has(r.sourceEntityId)) continue;
    const set = sourcesOf.get(r.targetEntityId);
    if (set) set.add(r.sourceEntityId);
    else sourcesOf.set(r.targetEntityId, new Set([r.sourceEntityId]));
  }

  // Every source that describes something already in the region, and one
  // member it describes — so the reason can name a real entity.
  const memberBySource = new Map<string, string>();
  for (const memberId of scopeIds) {
    for (const sourceId of sourcesOf.get(memberId) ?? []) {
      if (!memberBySource.has(sourceId)) memberBySource.set(sourceId, memberId);
    }
  }

  // `near` edges touching a member. Coordinate-derived — see the header.
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
    let matched: { sourceId: string; memberId: string } | undefined;
    for (const sourceId of sourcesOf.get(id) ?? []) {
      const memberId = memberBySource.get(sourceId);
      if (memberId) {
        matched = { sourceId, memberId };
        break;
      }
    }

    if (matched) {
      const label =
        sourceById.get(matched.sourceId)?.source ?? "a source Atlas holds";
      out.set(id, {
        tier: "shared-source",
        because: `${label} also describes ${nameById.get(matched.memberId) ?? "an entity in this region"}.`,
      });
      continue;
    }

    const near = nearMember.get(id);
    if (near) {
      out.set(id, {
        tier: "proximity",
        because: `Atlas computed a "near" link to ${nameById.get(near) ?? "an entity in this region"} from stored coordinates — not from anything a source said.`,
      });
      continue;
    }

    out.set(id, { tier: "none", because: "" });
  }

  return out;
}
