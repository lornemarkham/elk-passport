import "server-only";
import type { WorkspaceBundle } from "./workspaceData";

/**
 * **What is in a region** — its asserted members, and everything those
 * members contain.
 *
 * ## Why the workspace shows more than the members
 *
 * The roster used to list direct members only: Okanagan showed *one*
 * entity while seven were reachable through it. That is technically the
 * membership set and operationally useless — the six venues inside Big
 * White are the work, and a curator cannot act on what the page does not
 * list.
 *
 * The alternative — writing a direct `contains` edge from the region to
 * every discovered venue — was rejected in `RegionGrowthService`. It would
 * assert *regional membership* on something that has *physical
 * containment*, and `contains` cannot distinguish them (ADR 026). Two
 * edges, one meaning lost.
 *
 * **So the page widens what it truthfully shows rather than writing edges
 * that overstate what is known.** Both facts here were asserted by
 * someone: a curator placed Big White in the Okanagan, and directory
 * expansion recorded that Big White contains The BullWheel. Nothing is
 * inferred from geography.
 *
 * ## Direct and indirect stay distinguishable
 *
 * Every member carries how it got here. A curator reviewing membership
 * needs to know which entities *they* placed, and a count that silently
 * merged the two would hide exactly the decision they are auditing.
 */

export type Membership = "direct" | "indirect";

export interface RegionScope {
  /** Every entity id in the region — members and what they contain. */
  readonly ids: ReadonlySet<string>;
  /** How each id got here. */
  readonly membership: ReadonlyMap<string, Membership>;
  readonly directCount: number;
  readonly indirectCount: number;
}

const EMPTY: RegionScope = {
  ids: new Set(),
  membership: new Map(),
  directCount: 0,
  indirectCount: 0,
};

/**
 * Breadth-first from the asserted members.
 *
 * Uses a visited set because nothing in the model prevents a cycle —
 * `contains` is written by four unrelated code paths and none of them
 * checks. A depth-first walk without one would hang the page.
 */
export function regionScope(
  memberIds: readonly string[],
  bundle: WorkspaceBundle | null,
): RegionScope {
  if (!bundle) return EMPTY;

  const membership = new Map<string, Membership>();
  for (const id of memberIds) membership.set(id, "direct");

  const childrenOf = new Map<string, string[]>();
  for (const r of bundle.relationships) {
    if (r.type !== "contains") continue;
    const list = childrenOf.get(r.sourceEntityId);
    if (list) list.push(r.targetEntityId);
    else childrenOf.set(r.sourceEntityId, [r.targetEntityId]);
  }

  const queue = [...memberIds];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const child of childrenOf.get(id) ?? []) {
      if (membership.has(child)) continue;
      membership.set(child, "indirect");
      queue.push(child);
    }
  }

  let directCount = 0;
  let indirectCount = 0;
  for (const how of membership.values()) {
    if (how === "direct") directCount += 1;
    else indirectCount += 1;
  }

  return {
    ids: new Set(membership.keys()),
    membership,
    directCount,
    indirectCount,
  };
}
