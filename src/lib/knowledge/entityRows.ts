import "server-only";
import type { PickerEntity } from "@/components/admin/entities/EntityPicker";
import type { WorkspaceBundle } from "./workspaceData";
import type { Membership } from "./regionScope";

/**
 * The rows an entity browser shows, built once.
 *
 * Extracted so the global list (`/admin/entities`) and the region-scoped
 * list (the Region workspace) cannot drift into showing different columns
 * for the same entity. They are the same browser with a different scope,
 * and two copies of this mapping did eventually prove it: the global page
 * carried an inline duplicate for weeks and silently missed a column the
 * region list had gained.
 *
 * ## Every field is measured, none is derived from taste
 *
 * `score` is Atlas's own completeness score. `sourceCount` counts
 * `describes` edges from real SourceRecords. `containsCount` and
 * `relationshipCount` count real edges. **Nothing here is a rating, a
 * grade, or a judgement** — the browser sorts and filters on facts, and
 * leaves interpretation to the curator.
 *
 * `score: null` is preserved rather than defaulted to `0`. An unmeasured
 * entity is not a bad one, and a fabricated zero would both read and
 * *sort* as though it were.
 */

export interface BuildRowsOptions {
  /** Narrow to these ids — how a region scopes the list. Absent means everything. */
  readonly only?: ReadonlySet<string>;
  /** Direct or indirect membership, when the scope is a region. */
  readonly membership?: ReadonlyMap<string, Membership>;
  /** Entity ids with a research finding waiting on a decision. */
  readonly awaitingReview?: ReadonlySet<string>;
  /** Entity ids with research requested and not yet back. */
  readonly researching?: ReadonlySet<string>;
  /**
   * What the most recent run did to each entity.
   *
   * Read from that run's own `IngestionEvent`s, so the badge on a row and
   * the story in the Observatory are the same rows. **An operation that
   * leaves no trace on the thing it changed is an operation a curator has
   * to take on faith.**
   */
  readonly changed?: ReadonlyMap<string, "new" | "updated">;
}

export function buildEntityRows(
  bundle: WorkspaceBundle,
  options: BuildRowsOptions = {},
): PickerEntity[] {
  const { entities, sources, relationships, scores } = bundle;
  const { only, membership, awaitingReview, researching, changed } = options;

  const scoreById = new Map(scores.map((s) => [s.entityId, s.overallPercent]));
  const sourceIds = new Set(sources.map((s) => s.id));

  const sourceCountById = new Map<string, number>();
  const containsCountById = new Map<string, number>();
  // Every edge touching the entity in either direction, minus `describes`
  // (which is provenance, already counted as sources). One pass; the row
  // count is large enough that per-row scans would be O(rows × edges).
  const relationshipCountById = new Map<string, number>();
  const bump = (map: Map<string, number>, id: string) =>
    map.set(id, (map.get(id) ?? 0) + 1);

  for (const r of relationships) {
    if (r.type === "describes") {
      if (sourceIds.has(r.sourceEntityId))
        bump(sourceCountById, r.targetEntityId);
      continue;
    }
    if (r.type === "contains") bump(containsCountById, r.sourceEntityId);
    bump(relationshipCountById, r.sourceEntityId);
    bump(relationshipCountById, r.targetEntityId);
  }

  return entities
    .filter((e) => !only || only.has(String(e.id)))
    .map((e) => {
      const id = String(e.id);
      return {
        id,
        name: String(e.name),
        kind: String(e.kind),
        // The source's own word for what this is — "ski resort",
        // "winery", "park". Never normalised (ADR 017), which is exactly
        // why it is worth showing: it is evidence, not a category we
        // imposed.
        subtype:
          (e.placeType as string) ??
          (e.organizationType as string) ??
          (e.activityType as string) ??
          (e.eventType as string),
        score: scoreById.get(id) ?? null,
        sourceCount: sourceCountById.get(id) ?? 0,
        containsCount: containsCountById.get(id) ?? 0,
        relationshipCount: relationshipCountById.get(id) ?? 0,
        hasImage: Boolean(e.imageUrl),
        membership: membership?.get(id),
        awaitingReview: awaitingReview?.has(id) ?? false,
        researching: researching?.has(id) ?? false,
        changed: changed?.get(id),
      };
    });
}
