import "server-only";
import { listDiscoveryCandidates } from "@/lib/data/atlas-repo";
import { isAtlasUnavailable } from "@/lib/data/atlasAuth";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import type { Experience } from "@/domain/experience/types";
import { distanceKm } from "@/lib/environment/geo";
import { environmentFor } from "@/lib/environment/reading";
import { offeredPlaceIds } from "@/domain/date-night/answer";
import {
  dayForecast,
  sunlightFor,
  type DayForecast,
  type Sunlight,
} from "@/domain/date-night/conditions";
import type { DateNight } from "@/domain/date-night/types";

/** An Atlas place a night offers, as Atlas holds it today. */
export interface NightPlace {
  readonly id: string;
  readonly experience: Experience;
  /** Straight-line km from the night's area, from Atlas's coordinates. */
  readonly km?: number;
}

export interface InvitationData {
  /** Keyed by Atlas id. An id Atlas did not return is simply absent. */
  readonly places: Readonly<Record<string, NightPlace>>;
  /** Atlas could not be read; the ideas still stand without its facts. */
  readonly atlasDown: boolean;
  readonly sunlight?: Sunlight;
  readonly forecast?: DayForecast;
}

/**
 * Atlas through the same cached corpus read Discovery and Christmas use —
 * no new Atlas call — and the forecast through the one switch that decides
 * whether Passport reads the weather at all (`WEATHER_PROVIDER=msc`).
 */
export async function invitationData(
  night: DateNight,
): Promise<InvitationData> {
  const wanted = offeredPlaceIds(night);
  const area = {
    id: `date-night-${night.slug}`,
    name: night.area.label,
    latitude: night.area.latitude,
    longitude: night.area.longitude,
  };
  const [atlas, environments] = await Promise.all([
    wanted.size === 0
      ? Promise.resolve({ places: {}, atlasDown: false })
      : listDiscoveryCandidates()
          .then((candidates) => {
            const places: Record<string, NightPlace> = {};
            for (const c of candidates) {
              if (!wanted.has(c.id)) continue;
              const experience = candidateToExperience(c);
              const loc = experience.location;
              const km =
                loc?.latitude !== undefined && loc.longitude !== undefined
                  ? distanceKm(night.area, {
                      latitude: loc.latitude,
                      longitude: loc.longitude,
                    })
                  : undefined;
              places[c.id] = {
                id: c.id,
                experience,
                ...(km !== undefined ? { km: Math.round(km) } : {}),
              };
            }
            return { places, atlasDown: false };
          })
          .catch((error: unknown) => {
            const why = isAtlasUnavailable(error)
              ? error.reason
              : "unreachable";
            console.error(`[atlas] date night places unavailable (${why})`);
            return { places: {}, atlasDown: true };
          }),
    environmentFor([area]),
  ]);
  const sunlight = sunlightFor(night);
  const forecast = dayForecast(environments.get(area.id), night);
  return {
    ...atlas,
    ...(sunlight ? { sunlight } : {}),
    ...(forecast ? { forecast } : {}),
  };
}
