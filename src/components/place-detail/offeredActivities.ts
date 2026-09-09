import type { PlaceRelatedEntity, PlaceRelationship } from "@/lib/data/types";

/**
 * **The Activities a place asserts it offers.**
 *
 * `offers` is the one non-Place relationship on these pages with an obvious
 * traveller use: Atlas is saying *you can do this here*, sourced, on an edge it
 * asserted. Kalamalka Lake has seven, Ellison Park eight, Kalamalka Lake Park
 * nine — and every one of them used to arrive as an id with no name attached,
 * because the detail response only resolved related **Places**.
 *
 * ## What this deliberately does not do
 *
 * No inference and no name-matching. An Activity appears only when Atlas
 * asserted the edge and returned the entity on the other end; a missing entity
 * is skipped rather than guessed at. Direction is respected too — `offers`
 * points from the place outward, so an edge arriving the other way is somebody
 * else offering something, not this place offering it.
 */
export interface OfferedActivity {
  readonly id: string;
  readonly name: string;
  readonly subtype?: string;
}

export function offeredActivities(
  placeId: string,
  relationships: readonly PlaceRelationship[],
  relatedEntities: readonly PlaceRelatedEntity[] = [],
): OfferedActivity[] {
  const byId = new Map(relatedEntities.map((entity) => [entity.id, entity]));
  const seen = new Set<string>();
  const result: OfferedActivity[] = [];

  for (const relationship of relationships) {
    if (relationship.type !== "offers") continue;
    // Outward only: this place offering something, not being offered.
    if (relationship.sourceEntityId !== placeId) continue;

    const entity = byId.get(relationship.targetEntityId);
    // A related entity Atlas did not return — archived, or an older Atlas that
    // predates `relatedEntities`. Skipped, never rendered as an id.
    if (!entity || entity.kind !== "Activity") continue;
    if (seen.has(entity.id)) continue;

    seen.add(entity.id);
    result.push({ id: entity.id, name: entity.name, subtype: entity.subtype });
  }

  return result;
}
