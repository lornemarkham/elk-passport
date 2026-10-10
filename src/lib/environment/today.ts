import {
  readWeather,
  type DayWeather,
  type Point,
} from "@/domain/discovery/situation";
import type { OctoberPlace } from "@/domain/environment/places";
import { hoursBetween } from "@/domain/environment/types";
import { environmentFor } from "./reading";

/**
 * **The rest of today's sky over one point on the earth.**
 *
 * The whole of the location bridge, and it is four lines of real work, because
 * the provider was already built for this. `citypageweather-realtime` is
 * queried by bounding box: `mscProvider` draws a 0.6° box around whatever
 * latitude and longitude it is handed, asks for ten candidate cities, and keeps
 * the nearest. Nothing in it is specific to the twenty-two towns October ships
 * with — those are just the points Passport happened to ask about until now.
 *
 * So a person's own coordinates go in as an ad-hoc area and the nearest city
 * Environment Canada publishes comes back out.
 *
 * ## The limitation, stated rather than hidden
 *
 * This is not hyperlocal weather and Passport must never imply it is. It is
 * **the official forecast for the nearest city MSC publishes**, which can be
 * tens of kilometres away and over a ridge. `area` is that city's name and `km`
 * is how far it is, and both are rendered — the rule the provider was written
 * under is that October may use Kelowna's forecast for Peachland only if it is
 * willing to say "Kelowna" out loud.
 *
 * Two consequences fall out of that and are not worked around:
 *
 * - **Canada only.** Environment Canada publishes Canadian cities. Somewhere
 *   with no city inside the box — rural Yukon, or Seattle — simply gets
 *   nothing, and the surface says so.
 * - **Nothing is interpolated.** A model grid could produce a number for any
 *   point, but it would stop being the official forecast, which is the thing
 *   worth having.
 */
export interface TodayWeather extends DayWeather {
  /** The city Environment Canada publishes this for. Shown, always. */
  readonly area?: string;
  /** How far that city is from the point asked about, in km. */
  readonly km?: number;
}

export async function weatherToday(
  point: Point,
  now: Date,
  /** A name for the point, used only if MSC does not name the city it found. */
  label = "your area",
): Promise<TodayWeather | undefined> {
  const area: OctoberPlace = {
    // Not a real `OctoberPlace` and deliberately not added to the list of
    // them: it exists for the length of one request, keys one map, and is
    // never stored. The provider only needs a point and something to key by.
    id: "here",
    name: label,
    ...point,
  };
  try {
    const environment = (await environmentFor([area])).get(area.id);
    if (!environment) return undefined;
    // The rest of today, not the next 48 hours — somebody asking what to do
    // this afternoon is not served by tomorrow morning's sky.
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    const reading = readWeather(
      hoursBetween(environment, now.toISOString(), endOfDay.toISOString()),
      environment.provenance.source,
    );
    if (!reading) return undefined;
    const { stationName, stationKm } = environment.provenance;
    return {
      ...reading,
      area: stationName ?? label,
      ...(stationKm !== undefined ? { km: stationKm } : {}),
    };
  } catch {
    // An unreachable forecast is an ordinary outcome, and a page that cannot
    // get one says nothing about the weather rather than guessing at it.
    return undefined;
  }
}
