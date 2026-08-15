import "server-only";

/**
 * Regions, from the app's side.
 *
 * ## The product hierarchy this exists to make truthful
 *
 * ```
 * Atlas  →  Region  →  Entities  →  Entity  →  Passport
 * ```
 *
 * A Region is a `Place` whose `placeType` is `region`; membership is the
 * existing `contains` relationship. Both rules live in Atlas
 * (`domain/shared/region.ts`) and are **served**, not re-derived here — a
 * second implementation of "what counts as a region" would be a second
 * thing to keep correct.
 *
 * ## Unassigned is a first-class result
 *
 * `unassignedIds` is returned and rendered, not filtered away. Today it is
 * nearly the whole corpus: 167 entities exist and almost none has been
 * placed. A Regions page that quietly omitted them would be asserting a
 * tidiness that isn't real — the same defect as a knowledge section hiding
 * a fact nobody wrote a template for.
 */

const ATLAS_BASE_URL = "http://localhost:3000";

export interface RegionSummary {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly imageUrl: string | null;
  readonly memberIds: readonly string[];
}

export interface RegionsResult {
  readonly regions: readonly RegionSummary[];
  readonly unassignedIds: readonly string[];
}

const EMPTY: RegionsResult = { regions: [], unassignedIds: [] };

/**
 * Returns empty rather than throwing when Atlas is unreachable. The admin
 * should degrade to "no regions known" rather than to a stack trace — but
 * note that empty here and empty in the database look the same, which is
 * why the page says which it is.
 */
export async function loadRegions(): Promise<RegionsResult> {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return EMPTY;
  try {
    const response = await fetch(`${ATLAS_BASE_URL}/admin/regions`, {
      headers: { "x-admin-token": token },
      cache: "no-store",
    });
    if (!response.ok) return EMPTY;
    return (await response.json()) as RegionsResult;
  } catch {
    return EMPTY;
  }
}

export function findRegion(
  result: RegionsResult,
  id: string,
): RegionSummary | undefined {
  return result.regions.find((r) => r.id === id);
}

/** Which region has claimed this entity, if any. Used by the entity page for its breadcrumb. */
export function regionForEntity(
  result: RegionsResult,
  entityId: string,
): RegionSummary | undefined {
  return result.regions.find((r) => r.memberIds.includes(entityId));
}
