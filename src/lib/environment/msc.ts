import type { OctoberPlace } from "@/domain/environment/places";
import { distanceKm } from "./geo";
import type {
  Environment,
  ForecastProvider,
  HourlyConditions,
  NightOutlook,
  SkyCondition,
} from "@/domain/environment/types";

/**
 * **Environment Canada, behind the port.**
 *
 * `api.weather.gc.ca` — the MSC GeoMet OGC API, the Canadian government's own
 * weather service. Chosen over the alternatives for one reason that matters
 * more than the others: its data is published under the **Open Government
 * Licence – Canada, which permits commercial use**, free, with attribution.
 * Open-Meteo's free tier is explicitly non-commercial, and this is a business.
 *
 * No account, no API key, no quota to buy. Attribution is a licence obligation
 * and `Provenance.source` carries it to the surface so it cannot be forgotten.
 *
 * ## It is city-based, and that is honest rather than a limitation
 *
 * The `citypageweather-realtime` collection holds forecasts for named Canadian
 * cities, not arbitrary points. So an area resolves to the nearest city MSC
 * actually publishes, and `Provenance.stationName` says which — because
 * "Vernon's forecast" shown for Cherryville is only acceptable if the product
 * is willing to say out loud that it is Vernon's.
 *
 * The alternative is a model-grid interpolation that would be no more true and
 * would stop being the official forecast, which is the thing worth having.
 *
 * ## Not wired on by default
 *
 * `environment/reading.ts` calls this only when `WEATHER_PROVIDER=msc` is set.
 * Choosing to depend on an outside service is Lorne's call, not a side effect
 * of a slice landing.
 */

const COLLECTION =
  "https://api.weather.gc.ca/collections/citypageweather-realtime/items";

/** How far around a place to look for a city MSC publishes, in degrees. */
const SEARCH_DEGREES = 0.6;

/**
 * Environment Canada's forecaster vocabulary, mapped to sky cover.
 *
 * Deliberately a lookup over their actual condition strings rather than
 * keyword matching: "A few clouds" and "Cloudy periods" would both match
 * `cloud` and they do not mean the same thing to somebody hoping to see
 * meteors. Anything unlisted becomes `unknown` and the interpretation layer
 * declines to speak, which is the correct outcome for a word nobody has
 * checked.
 */
const SKY_OF: Record<string, SkyCondition> = {
  sunny: "clear",
  clear: "clear",
  "mainly sunny": "mainly-clear",
  "mainly clear": "mainly-clear",
  "a few clouds": "mainly-clear",
  "a mix of sun and cloud": "partly-cloudy",
  "partly cloudy": "partly-cloudy",
  "cloudy periods": "partly-cloudy",
  "mainly cloudy": "mostly-cloudy",
  "mostly cloudy": "mostly-cloudy",
  cloudy: "overcast",
  overcast: "overcast",
};

/** Anything falling out of the sky, however the forecaster phrased it. */
const WET = [
  "rain",
  "shower",
  "drizzle",
  "snow",
  "flurr",
  "sleet",
  "thunder",
  "ice pellet",
  "freezing",
  "precipitation",
];

export function skyFrom(condition: string | undefined): SkyCondition {
  if (!condition) return "unknown";
  const said = condition.trim().toLowerCase();
  if (WET.some((w) => said.includes(w))) return "precipitating";
  return SKY_OF[said] ?? "unknown";
}

/** MSC wraps every leaf in `{en, fr}`. One place knows that. */
const en = (v: unknown): unknown =>
  v && typeof v === "object" && "en" in (v as Record<string, unknown>)
    ? (v as Record<string, unknown>).en
    : v;

const num = (v: unknown): number | undefined => {
  const n = typeof v === "number" ? v : Number(en(v));
  return Number.isFinite(n) ? n : undefined;
};

/**
 * Night periods, dated.
 *
 * MSC names periods relatively — "Tonight", "Thursday night" — so the dates
 * come from the order they arrive in rather than from parsing a weekday name:
 * the first night period is the night of the issue date, and each one after it
 * is the next day. Reading "Thursday" and looking up which Thursday is the
 * version of this that breaks once a year.
 */
export function nightsFrom(
  forecasts: unknown,
  issuedAt: string,
): NightOutlook[] {
  if (!Array.isArray(forecasts)) return [];
  const start = new Date(issuedAt);
  if (Number.isNaN(start.getTime())) return [];

  const out: NightOutlook[] = [];
  for (const period of forecasts) {
    const name = en(period?.period?.textForecastName);
    if (typeof name !== "string") continue;
    if (!/night$/i.test(name.trim())) continue;

    const day = new Date(start);
    // MSC issues in UTC; the night of the issue date is the local day it is
    // already evening-or-earlier on, which at these longitudes is the UTC
    // date minus the offset. Anchoring at local midday avoids the edge.
    day.setUTCHours(12, 0, 0, 0);
    day.setUTCDate(day.getUTCDate() + out.length);

    const described = en(period?.abbreviatedForecast?.textSummary);
    const temps = period?.temperatures?.temperature;
    const low = Array.isArray(temps)
      ? temps.find(
          (x: unknown) => en((x as Record<string, unknown>)?.class) === "low",
        )
      : undefined;
    const pop = num(period?.abbreviatedForecast?.pop?.value);

    out.push({
      day: day.toISOString().slice(0, 10),
      sky: skyFrom(typeof described === "string" ? described : undefined),
      ...(typeof described === "string" ? { description: described } : {}),
      ...(num(low?.value) !== undefined ? { lowC: num(low?.value) } : {}),
      ...(pop !== undefined ? { precipitationChance: pop } : {}),
    });
  }
  return out;
}

interface MscHour {
  readonly timestamp?: string;
  readonly condition?: unknown;
  readonly temperature?: { readonly value?: unknown };
  readonly lop?: { readonly value?: unknown };
  readonly wind?: { readonly speed?: { readonly value?: unknown } };
}

/** One MSC feature's properties into Passport's own shape. */
export function readMscFeature(
  area: OctoberPlace,
  properties: Record<string, unknown>,
  fetchedAt: Date,
  stationKm?: number,
): Environment | undefined {
  const group = properties.hourlyForecastGroup as
    { timestamp?: unknown; hourlyForecasts?: MscHour[] } | undefined;
  const rows = group?.hourlyForecasts;
  const daily = properties.forecastGroup as
    { timestamp?: unknown; forecasts?: unknown } | undefined;
  const dailyIssued = en(daily?.timestamp);
  const nights = nightsFrom(
    daily?.forecasts,
    typeof dailyIssued === "string" ? dailyIssued : fetchedAt.toISOString(),
  );
  if ((!Array.isArray(rows) || rows.length === 0) && nights.length === 0) {
    return undefined;
  }

  const hourly: HourlyConditions[] = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row?.timestamp) continue;
    const description = en(row.condition);
    hourly.push({
      at: row.timestamp,
      sky: skyFrom(typeof description === "string" ? description : undefined),
      ...(typeof description === "string" ? { description } : {}),
      ...(num(row.temperature?.value) !== undefined
        ? { temperatureC: num(row.temperature?.value) }
        : {}),
      ...(num(row.lop?.value) !== undefined
        ? { precipitationChance: num(row.lop?.value) }
        : {}),
      ...(num(row.wind?.speed?.value) !== undefined
        ? { windKph: num(row.wind?.speed?.value) }
        : {}),
    });
  }
  if (hourly.length === 0 && nights.length === 0) return undefined;

  // `lastUpdated` is MSC's own statement of when this document was refreshed,
  // and it is the only honest answer to "how old is this". The per-group
  // timestamps are when each *product* was generated — the hourly block can
  // carry an 8-hour-old stamp on a document republished minutes ago, and
  // reading that as the age makes fresh data look stale.
  const updated = en(properties.lastUpdated);
  const issued = typeof updated === "string" ? updated : en(group?.timestamp);
  const name = en(properties.name);

  return {
    area,
    hourly,
    nights,
    provenance: {
      // The licence requires attribution, so it travels with the data rather
      // than living in a component somebody might later delete.
      source: "Environment Canada",
      ...(typeof name === "string" ? { stationName: name } : {}),
      ...(stationKm !== undefined ? { stationKm: Math.round(stationKm) } : {}),
      issuedAt: typeof issued === "string" ? issued : fetchedAt.toISOString(),
      fetchedAt: fetchedAt.toISOString(),
    },
  };
}

/**
 * The live provider. One request per area — MSC's collection is queried by
 * bounding box and there is no documented multi-box form — but the areas asked
 * for are the handful a page actually needs, deduplicated by the caller, not
 * one per card.
 */
export function mscProvider(fetchImpl: typeof fetch = fetch): ForecastProvider {
  return {
    name: "msc",
    async forecast(areas) {
      const out = new Map<string, Environment>();
      const now = new Date();

      await Promise.all(
        areas.map(async (area) => {
          const bbox = [
            area.longitude - SEARCH_DEGREES,
            area.latitude - SEARCH_DEGREES,
            area.longitude + SEARCH_DEGREES,
            area.latitude + SEARCH_DEGREES,
          ].join(",");
          try {
            const response = await fetchImpl(
              // Ten candidates, then the nearest — not the first. A box wide
              // enough to find Lumby also contains Kelowna, and MSC returns
              // them in its own order.
              `${COLLECTION}?f=json&limit=10&bbox=${bbox}`,
              // A forecast is worth re-reading, but not on every render.
              { next: { revalidate: 1800 } } as RequestInit,
            );
            if (!response.ok) return;
            const body = (await response.json()) as {
              features?: {
                geometry?: { coordinates?: [number, number] };
                properties?: Record<string, unknown>;
              }[];
            };
            const nearest = (body.features ?? [])
              .map((feature) => {
                const [lon, lat] = feature.geometry?.coordinates ?? [];
                return {
                  feature,
                  km:
                    typeof lat === "number" && typeof lon === "number"
                      ? distanceKm(area, { latitude: lat, longitude: lon })
                      : Number.POSITIVE_INFINITY,
                };
              })
              .sort((a, b) => a.km - b.km)[0];
            const properties = nearest?.feature.properties;
            if (!properties) return;
            const reading = readMscFeature(
              area,
              properties,
              now,
              Number.isFinite(nearest!.km) ? nearest!.km : undefined,
            );
            if (reading) out.set(area.id, reading);
          } catch {
            // An unreachable forecast is an ordinary outcome. The area is
            // absent from the map and October says nothing about it.
          }
        }),
      );

      return out;
    },
  };
}
