import "server-only";
import type { WorkspaceBundle } from "./workspaceData";

/**
 * **Hierarchy as context, not as navigation.**
 *
 * ## The question this answers
 *
 * Should a Region page render the `contains` graph as a tree —
 * `Okanagan → Big White → BullWheel, Snowshoe Sam's, The Woods` — instead
 * of a flat list?
 *
 * **Partly.** Structure is shown; the browser stays a list. Three reasons,
 * all from the current architecture rather than from taste.
 *
 * ### 1. `contains` means two different things and nothing marks which
 *
 * Four code paths write `type: 'contains'` — `defineRegionCli`,
 * `DirectoryExpansionService`, `ContainmentService`,
 * `discoverContainsCandidatesCli` — and `RelationshipType` carries no
 * qualifier. *"Okanagan contains Big White"* (regional membership) and
 * *"Big White contains The BullWheel"* (physical containment) are the same
 * edge.
 *
 * A tree renderer walking `contains` from a region would therefore have to
 * decide, at every level, which meaning it had just followed — and today
 * there is nothing to decide it with. Rendering both as one tree would
 * quietly assert that regional membership and being-inside-a-building are
 * the same relation. They are not: a restaurant is *in* the Okanagan in
 * every sense that matters to a traveller, and it is not a *member* of it
 * in the sense a curator asserted.
 *
 * ### 2. A tree is a bad operational list
 *
 * The entity browser's job is *"which entities need attention?"* — sorted
 * by completeness, filtered by kind, searchable. **Sorting a tree by
 * completeness destroys the tree**, because the answer reorders parents
 * and children independently. You can have hierarchy or you can have
 * prioritisation; a browser that must answer "what is thinnest" has to
 * choose prioritisation.
 *
 * ### 3. The shape is 90% leaves
 *
 * Big White contains six venues. Almost every other entity contains
 * nothing. A tree over that shape is a flat list with extra indentation
 * and a disclosure triangle that never has anything behind it.
 *
 * ## So: counts, not trees
 *
 * A region's members carry *how many things are inside them*. That single
 * number surfaces the structure — "Big White Ski Resort · 6 inside" reads
 * as a unit of work, where a bare row does not — without pretending the
 * graph is a navigation model. Drilling into Big White shows its children,
 * which the entity workspace already does through Relationships.
 *
 * ## What this makes visible, and must not hide
 *
 * `regionMemberIds` returns **direct** members. If only Big White is placed
 * in the Okanagan, the region's roster is one entity while seven things are
 * reachable through it. That gap is real, and `descendantCount` exists so
 * the page can state it rather than let a "1 entity" label imply a region
 * containing seven is nearly empty.
 */

/**
 * How many entities are reachable through this one via `contains`.
 *
 * Breadth-first with a visited set, because nothing in the model prevents
 * a cycle — `contains` is written by four unrelated code paths and none of
 * them checks. A tree renderer would have had to solve this too; a count
 * solves it once, here.
 */
export function descendantCount(
  rootId: string,
  bundle: WorkspaceBundle | null,
): number {
  if (!bundle) return 0;

  const childrenOf = new Map<string, string[]>();
  for (const r of bundle.relationships) {
    if (r.type !== "contains") continue;
    const list = childrenOf.get(r.sourceEntityId);
    if (list) list.push(r.targetEntityId);
    else childrenOf.set(r.sourceEntityId, [r.targetEntityId]);
  }

  const seen = new Set<string>([rootId]);
  const queue = [rootId];
  let count = 0;

  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const child of childrenOf.get(id) ?? []) {
      if (seen.has(child)) continue;
      seen.add(child);
      count += 1;
      queue.push(child);
    }
  }
  return count;
}

/** Direct children only — what the entity itself contains, one level down. */
export function directChildCount(
  entityId: string,
  bundle: WorkspaceBundle | null,
): number {
  if (!bundle) return 0;
  return bundle.relationships.filter(
    (r) => r.type === "contains" && r.sourceEntityId === entityId,
  ).length;
}
