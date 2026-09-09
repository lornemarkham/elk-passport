import type {
  PlaceOperator,
  PlaceRelatedEntity,
  PlaceRelationship,
} from "@/lib/data/types";
import { SectionShell } from "./SectionShell";
import { composedActivities } from "./offeredActivities";

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
  operatedBy,
}: {
  placeId: string;
  relationships: PlaceRelationship[];
  relatedEntities?: PlaceRelatedEntity[];
  operatedBy?: readonly PlaceOperator[];
}) {
  const activities = composedActivities(
    placeId,
    relationships,
    relatedEntities,
    operatedBy ?? [],
  );
  if (activities.length === 0) return null;

  // Named once under the list rather than on every chip: a row of identical
  // "via X" badges is noise, and staying silent about it would be worse.
  const operators = [
    ...new Map(
      activities
        .filter((activity) => activity.operator)
        .map((activity) => [activity.operator!.id, activity.operator!]),
    ).values(),
  ];

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
      {operators.length > 0 && (
        <p className="text-muted-foreground mt-3 text-xs">
          Some of these are offered by{" "}
          {operators.map((o) => o.name).join(" and ")}, which operates this
          place.
        </p>
      )}
    </SectionShell>
  );
}
