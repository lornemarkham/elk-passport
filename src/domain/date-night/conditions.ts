import type { Environment, HourlyConditions } from "@/domain/environment/types";
import { daylightAt } from "@/domain/environment/daylight";
import type { DateNight } from "./types";

/**
 * **What the sky is doing on the day, said only as far as it is known.**
 *
 * Sunset is arithmetic and always true. The forecast is Environment Canada's
 * for the city it publishes nearest the night's area, named on the page, and
 * only for the hours it actually covers — a forecast issued tonight reaches
 * into tomorrow, but it may not reach tomorrow evening, and then the page
 * says nothing about tomorrow evening.
 */

/** The instant a local wall-clock hour falls on, in an IANA zone. */
export function zonedInstant(on: string, hour: number, timeZone: string): Date {
  const [y, m, d] = on.split("-").map(Number);
  const guess = Date.UTC(y!, m! - 1, d!, hour);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(guess));
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  const shown = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
  );
  return new Date(guess - (shown - guess));
}

export function clockTime(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(at)
    .replace(/\./g, "")
    .replace(/\s+/g, " ");
}

export interface Sunlight {
  readonly sunrise: string;
  readonly sunset: string;
}

export function sunlightFor(night: DateNight): Sunlight | undefined {
  const light = daylightAt(
    night.area.latitude,
    night.area.longitude,
    zonedInstant(night.on, 12, night.timeZone),
  );
  if (!light) return undefined;
  return {
    sunrise: clockTime(light.sunrise, night.timeZone),
    sunset: clockTime(light.sunset, night.timeZone),
  };
}

export interface DayForecast {
  /** "Environment Canada" — attribution the licence requires. */
  readonly source: string;
  /** The city it is published for. */
  readonly city?: string;
  readonly issuedAt: string;
  /** Local hours covered, e.g. "9 am – 5 pm". */
  readonly covers: string;
  readonly lowC?: number;
  readonly highC?: number;
  /** Highest chance of precipitation in those hours, percent. */
  readonly wettestChance?: number;
  /** The forecaster's own words, in order, without repeats. */
  readonly words: readonly string[];
  readonly windKph?: number;
}

/** Daytime, as Date Night reads it: 9 am to 6 pm on the day. */
const FROM_HOUR = 9;
const TO_HOUR = 18;

export function dayForecast(
  environment: Environment | undefined,
  night: DateNight,
): DayForecast | undefined {
  if (!environment) return undefined;
  const from = zonedInstant(night.on, FROM_HOUR, night.timeZone).getTime();
  const to = zonedInstant(night.on, TO_HOUR, night.timeZone).getTime();
  const hours: HourlyConditions[] = environment.hourly
    .filter((h) => {
      const at = Date.parse(h.at);
      return at >= from && at < to;
    })
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  if (hours.length === 0) return undefined;

  const temps = hours
    .map((h) => h.temperatureC)
    .filter((t): t is number => typeof t === "number");
  const chances = hours
    .map((h) => h.precipitationChance)
    .filter((c): c is number => typeof c === "number");
  const winds = hours
    .map((h) => h.windKph)
    .filter((w): w is number => typeof w === "number");
  const words: string[] = [];
  for (const h of hours)
    if (h.description && !words.includes(h.description))
      words.push(h.description);

  const first = new Date(hours[0]!.at);
  const last = new Date(Date.parse(hours[hours.length - 1]!.at) + 3_600_000);
  return {
    source: environment.provenance.source,
    ...(environment.provenance.stationName
      ? { city: environment.provenance.stationName }
      : {}),
    issuedAt: environment.provenance.issuedAt,
    covers: `${clockTime(first, night.timeZone)} – ${clockTime(last, night.timeZone)}`,
    ...(temps.length
      ? { lowC: Math.min(...temps), highC: Math.max(...temps) }
      : {}),
    ...(chances.length ? { wettestChance: Math.max(...chances) } : {}),
    ...(winds.length ? { windKph: Math.max(...winds) } : {}),
    words: words.slice(0, 3),
  };
}
