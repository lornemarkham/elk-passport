import "server-only";
import { loadRunEvents, type IngestionRun } from "./runData";

/**
 * **What the most recent run actually did, per entity.**
 *
 * ## Why this exists
 *
 * An operation that leaves no trace on the things it changed is an
 * operation a curator has to take on faith. The completion summary says
 * *"+2 entities, +34 facts"*; this is what lets the entity list show
 * *which* two, so the claim and the evidence are on the same screen.
 *
 * ## Read from the run's own events
 *
 * `entity-created` and `entity-enriched` are stages the pipeline records
 * for the Observatory anyway. Deriving badges from them means a row's
 * `NEW` and the run's timeline cannot disagree — there is no second
 * record of what changed that could drift from the first.
 *
 * ## Deliberately only the most recent run
 *
 * "What changed because of what I just did" is the question. Accumulating
 * across runs would answer a different one — *what has ever changed* —
 * which is what the Observatory is for, and would leave badges on rows
 * forever with no way to tell recent from ancient.
 *
 * Returns an empty map on any failure. A missing badge costs a nicety; a
 * page that fails to render costs the session.
 */
export async function loadRecentChanges(
  run: IngestionRun | null,
): Promise<ReadonlyMap<string, "new" | "updated">> {
  const changes = new Map<string, "new" | "updated">();
  if (!run) return changes;

  try {
    for (const event of await loadRunEvents(run.id)) {
      if (!event.entityId) continue;
      if (event.stage === "entity-created") {
        // "new" outranks "updated": an entity created and then enriched
        // in the same run is new, and saying "updated" would imply Atlas
        // already knew about it.
        changes.set(event.entityId, "new");
      } else if (
        event.stage === "entity-enriched" &&
        changes.get(event.entityId) !== "new"
      ) {
        changes.set(event.entityId, "updated");
      }
    }
  } catch {
    return new Map();
  }
  return changes;
}
