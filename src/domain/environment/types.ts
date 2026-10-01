import type { OctoberPlace } from "./places";

/**
 * **What October knows about the world outside, in Passport's own words.**
 *
 * No provider's vocabulary crosses this line. Environment Canada says
 * `{"lop": {"category": {"en": "Nil"}, "value": {"en": 0}}}`; what the product
 * reasons about is `precipitationChance: 0`. The adapter's job is to make that
 * translation and to be the only place that knows either shape.
 *
 * The reason to be strict about it is not purity. It is that the interpretation
 * layer — the part that decides whether to say anything at all — has to be
 * testable against invented forecasts, and it cannot be if it is reading
 * bilingual nested objects from one particular government department.
 */

/** How much of the sky is covered, as a forecaster would say it. */
export type SkyCondition =
  | "clear"
  | "mainly-clear"
  | "partly-cloudy"
  | "mostly-cloudy"
  | "overcast"
  /** Something is falling, which for sky purposes is worse than overcast. */
  | "precipitating"
  /** The source said something this product does not recognise. */
  | "unknown";

export interface HourlyConditions {
  /** The hour this describes, as an instant. */
  readonly at: string;
  readonly sky: SkyCondition;
  /** The source's own words — kept for honesty, never parsed twice. */
  readonly description?: string;
  readonly temperatureC?: number;
  /** Percent, 0–100. Absent means the source did not say. */
  readonly precipitationChance?: number;
  readonly windKph?: number;
}

/**
 * **Where this came from and when**, carried everywhere so staleness can be
 * recognised rather than discovered.
 *
 * A forecast with no provenance is indistinguishable from a guess. Every
 * reading keeps the source, the moment the source issued it, and the moment
 * Passport fetched it — and the interpretation layer refuses to speak when
 * those are too old, rather than quietly presenting Tuesday's sky as today's.
 */
export interface Provenance {
  /** `"Environment Canada"`. Shown to people; licence requires attribution. */
  readonly source: string;
  /**
   * The city whose forecast this actually is.
   *
   * Not decoration. A public forecast is published for named cities, so an
   * area resolves to the nearest one — and the rule is that October may use
   * Kelowna's forecast for Peachland only if it is willing to *say* Kelowna.
   * Surfaces render this whenever it differs from the area's own name.
   */
  readonly stationName?: string;
  /** How far the station is from the area, in kilometres. */
  readonly stationKm?: number;
  /** When the source issued it. */
  readonly issuedAt: string;
  /** When Passport asked. */
  readonly fetchedAt: string;
}

/**
 * **A whole night, as the forecaster summarised it.**
 *
 * Hourly data runs out after a day; a meteor shower is a week away. The night
 * periods of a public forecast — "Friday night: Clear, low 8" — are the only
 * thing that reaches that far, and they are what a person would read anyway.
 * Coarser than hourly and honestly so: one sky for the night, not six.
 */
export interface NightOutlook {
  /** The local day the night *starts* on, `YYYY-MM-DD`. */
  readonly day: string;
  readonly sky: SkyCondition;
  /** The forecaster's own words. */
  readonly description?: string;
  readonly lowC?: number;
  readonly precipitationChance?: number;
}

export interface Environment {
  /** The area this describes. Never the device's location. */
  readonly area: OctoberPlace;
  readonly hourly: readonly HourlyConditions[];
  /** Night summaries, which reach further out than `hourly` ever does. */
  readonly nights: readonly NightOutlook[];
  readonly provenance: Provenance;
}

/**
 * **A forecast port, batched by design.**
 *
 * One call for many areas, because the alternative is a request per card and
 * that mistake is easier to prevent in a signature than to remember not to
 * make. An implementation returns what it has: an area it cannot answer for is
 * simply absent from the map, which is the difference between *no forecast*
 * and *a forecast of nothing*.
 */
export interface ForecastProvider {
  readonly name: string;
  forecast(
    areas: readonly OctoberPlace[],
  ): Promise<ReadonlyMap<string, Environment>>;
}

/** The hours of a reading that fall inside a window, in order. */
export function hoursBetween(
  environment: Environment,
  fromIso: string,
  toIso: string,
): readonly HourlyConditions[] {
  return environment.hourly
    .filter((h) => h.at >= fromIso && h.at < toIso)
    .sort((a, b) => (a.at < b.at ? -1 : 1));
}

/**
 * How old a reading is, in hours, at a given moment.
 *
 * Measured from when the **source issued** it rather than when Passport
 * fetched it. A cache that served a four-hour-old forecast a second ago is
 * four hours old, and reporting it as fresh is how a product ends up confident
 * about weather that has already happened.
 */
export function ageInHours(environment: Environment, now: Date): number {
  const issued = Date.parse(environment.provenance.issuedAt);
  if (Number.isNaN(issued)) return Number.POSITIVE_INFINITY;
  return (now.getTime() - issued) / 3_600_000;
}
