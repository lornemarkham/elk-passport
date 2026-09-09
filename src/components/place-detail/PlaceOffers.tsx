import type { PlaceRelatedEntity, PlaceRelationship } from "@/lib/data/types";
import { SectionShell } from "./SectionShell";
import { offeredActivities } from "./offeredActivities";

/**
 * **What you can do here, according to Atlas's own `offers` edges.**
 *
 * Distinct from "Things to do", which reads `place.activities` — a list of
 * words on the Place record. These are **asserted relationships to Activity
 * entities**, so each one is a thing Atlas holds knowledge about separately.
 * Keeping them apart is the point: flattening an edge into a string would throw
 * away the only part that makes it more than a word.
 *
 * Not links yet — Passport has no Activity detail template, and a link to a 404
 * is worse than a name.
 */
export function PlaceOffers({
  placeId,
  relationships,
  relatedEntities,
}: {
  placeId: string;
  relationships: PlaceRelationship[];
  relatedEntities?: PlaceRelatedEntity[];
}) {
  const activities = offeredActivities(placeId, relationships, relatedEntities);
  if (activities.length === 0) return null;

  return (
    <SectionShell title="What you can do here">
      <ul className="flex flex-wrap gap-2" data-testid="place-offers">
        {activities.map((activity) => (
          <li
            key={activity.id}
            className="bg-muted rounded-full px-3 py-1.5 text-sm"
          >
            {activity.name}
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}
