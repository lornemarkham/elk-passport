import "server-only";
import { discoveryCandidates } from "@/lib/data/atlas-repo";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import { doesActivity } from "@/domain/discovery/activities";
import type { Experience } from "@/domain/experience/types";

/**
 * **Ski areas, as Atlas knows them.**
 *
 * Reads the same discovery corpus Discovery does and keeps what Atlas's own
 * words put in Skiing or Snowboarding (`doesActivity` — the activity
 * explorer's rule, not a new one here). Passport states nothing Atlas did
 * not: a name, where it is, Atlas's description, and a picture only when
 * Atlas says the picture is of the thing itself.
 *
 * `status` is the honest part. `unavailable` (Atlas not configured, not
 * answering) is a different answer from `none` (answered, no ski areas) and
 * the screen words them differently.
 */
export interface AtlasArea {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly region?: string;
  readonly latitude?: number;
  readonly longitude?: number;
  readonly image?: string;
  /** Who holds the picture. Always shown with it. */
  readonly attribution?: string;
}

export type AtlasAreas =
  | { status: "connected"; areas: AtlasArea[] }
  | { status: "unavailable"; areas: [] };

export function skiAreasFrom(pool: readonly Experience[]): AtlasArea[] {
  return pool
    .filter((e) => doesActivity(e, "skiing") || doesActivity(e, "snowboarding"))
    .map((e) => ({
      id: e.id,
      name: e.title,
      description: e.shortDescription,
      region: e.location?.region,
      latitude: e.location?.latitude,
      longitude: e.location?.longitude,
      ...(e.presentationImage?.relationship === "exact" &&
      e.presentationImage.depictsEntity
        ? {
            image: e.presentationImage.url,
            attribution: e.presentationImage.attribution,
          }
        : {}),
    }));
}

export async function atlasSkiAreas(): Promise<AtlasAreas> {
  const { candidates, outage } = await discoveryCandidates();
  if (outage) return { status: "unavailable", areas: [] };
  return {
    status: "connected",
    areas: skiAreasFrom(candidates.map(candidateToExperience)),
  };
}
