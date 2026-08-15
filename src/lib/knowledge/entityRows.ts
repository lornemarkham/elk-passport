import "server-only";
import type { PickerEntity } from "@/components/admin/entities/EntityPicker";
import type { WorkspaceBundle } from "./workspaceData";

/**
 * The rows an entity browser shows, built once.
 *
 * Extracted so the global list (`/admin/entities`) and the region-scoped
 * list (`/admin/regions/[id]/entities`) cannot drift into showing different
 * columns for the same entity. They are the same browser with a different
 * scope, and two copies of this mapping would eventually prove otherwise.
 *
 * `only` narrows to a set of ids — how a region scopes the list. Absent
 * means everything Atlas holds.
 */
export function buildEntityRows(
  bundle: WorkspaceBundle,
  only?: ReadonlySet<string>,
): PickerEntity[] {
  const { entities, sources, relationships, scores } = bundle;
  const scoreById = new Map(scores.map((s) => [s.entityId, s.overallPercent]));

  const sourceIds = new Set(sources.map((s) => s.id));
  const sourceCountById = new Map<string, number>();
  for (const r of relationships) {
    if (r.type !== "describes" || !sourceIds.has(r.sourceEntityId)) continue;
    sourceCountById.set(
      r.targetEntityId,
      (sourceCountById.get(r.targetEntityId) ?? 0) + 1,
    );
  }

  return entities
    .filter((e) => !only || only.has(String(e.id)))
    .map((e) => ({
      id: String(e.id),
      name: String(e.name),
      kind: String(e.kind),
      subtype:
        (e.placeType as string) ??
        (e.organizationType as string) ??
        (e.activityType as string) ??
        (e.eventType as string),
      score: scoreById.get(String(e.id)) ?? null,
      sourceCount: sourceCountById.get(String(e.id)) ?? 0,
      hasImage: Boolean(e.imageUrl),
    }));
}
