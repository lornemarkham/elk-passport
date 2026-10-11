import type { DayPlanned } from "@/domain/day/build";
import type { RainReading } from "@/lib/data/types";
import {
  rainBecause,
  rainEvidence,
  rainLine,
} from "@/domain/discovery/environment";
import { planDateLine } from "@/domain/day/plan";

/**
 * **What the sky might do, and what to put in the bag for it.**
 *
 * Three different kinds of sentence, the same discipline as the checklist:
 *
 * ```
 * forecast    a named source's forecast for a named area, printed in its
 *             words. Only when the caller hands one in; Passport never
 *             writes one, and the sample has none
 * per place   Atlas's own reading of what rain does to each stop
 *             (`candidate-environment/1`). Unknown for most places, and the
 *             page says unknown rather than "outdoor"
 * packing     Passport's suggestions for wet, cold and hot. Conditional, so
 *             none of them is a claim about the day's weather
 * ```
 *
 * No climate claims. "October evenings are cold" is true often enough to
 * sound like a fact and is not one about any particular Saturday.
 */

/**
 * A forecast in the shape of `TodayWeather` (`lib/environment/today.ts`), so
 * the one Discovery and the Day Builder already read passes straight in.
 */
export interface PrintForecast {
  readonly wet: boolean;
  readonly chance?: number;
  /** The source's own words for the worst hour. */
  readonly description?: string;
  readonly source: string;
  /** The city the forecast is published for. */
  readonly area?: string;
  /** How far that city is from where the day starts. */
  readonly km?: number;
}

export interface StopRain {
  readonly reading: RainReading;
  /** Atlas's reading, said as firmly as Atlas says it. */
  readonly line: string;
  /** The sentence Atlas read it from, where there is one. */
  readonly because?: string;
}

export interface WeatherPrep {
  readonly dateLine?: string;
  readonly forecast?: PrintForecast;
  /** Stops Atlas says stand up to rain: sheltered, partly, or run anyway. */
  readonly covered: readonly string[];
  readonly exposed: readonly string[];
  /** Atlas warns these may not run in bad weather at all. */
  readonly mayNotRun: readonly string[];
  /** Atlas has no reading. */
  readonly unknown: readonly string[];
  readonly ifWet: readonly string[];
  readonly ifCold: readonly string[];
  readonly ifHot: readonly string[];
}

export function stopRain(
  stop: DayPlanned["stops"][number],
): StopRain | undefined {
  const line = rainLine(stop.experience);
  if (!line) return undefined;
  const because = rainBecause(stop.experience);
  return {
    reading: rainEvidence(stop.experience).reading,
    line,
    ...(because ? { because } : {}),
  };
}

export function weatherFor(
  day: DayPlanned,
  forecast?: PrintForecast,
): WeatherPrep {
  const covered: string[] = [];
  const exposed: string[] = [];
  const mayNotRun: string[] = [];
  const unknown: string[] = [];
  for (const stop of day.stops) {
    const title = stop.experience.title;
    switch (rainEvidence(stop.experience).reading) {
      case "sheltered":
      case "partly-sheltered":
      case "runs-in-rain":
        covered.push(title);
        break;
      case "exposed":
        exposed.push(title);
        break;
      case "weather-dependent":
        mayNotRun.push(title);
        break;
      default:
        unknown.push(title);
    }
  }

  const child = day.brief.childAge;
  const kid = child !== undefined ? `the ${child}-year-old` : undefined;
  return {
    ...(day.brief.on ? { dateLine: planDateLine(day.brief.on) } : {}),
    ...(forecast ? { forecast } : {}),
    covered,
    exposed,
    mayNotRun,
    unknown,
    ifWet: [
      "A rain shell for everyone",
      "Dry socks, and a bag for wet things",
      kid ? `A full change of clothes for ${kid}` : "A towel in the car",
    ],
    ifCold: [
      "Hats and gloves",
      "One more layer than seems necessary",
      "Something hot in a thermos",
    ],
    ifHot: [
      "Sun hats and sunscreen",
      "Twice the water",
      "A shady stop for the middle of the day",
    ],
  };
}
