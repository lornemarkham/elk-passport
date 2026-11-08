/**
 * **Mountain conditions: what a weather model says, and nothing more.**
 *
 * Passport has no feed for a resort's own snow report, lift status or base
 * depth, and this file does not pretend to. It reads one thing: a published
 * weather-model forecast for the resort's coordinates (Open-Meteo, CC BY 4.0),
 * validates it hard, and turns it into plain sentences. Every sentence says
 * what it is: a model value for the valley point nearest the resort, not a
 * measurement from the hill and not the summit.
 *
 * Pure. No clock, no fetch: the caller passes the raw JSON and today's date.
 */
export interface ConditionsNow {
  readonly time: string;
  readonly tempC: number;
  readonly feelsLikeC: number;
  readonly windKmh: number;
  readonly gustKmh: number;
  readonly code: number;
  readonly snowCmPerHour: number;
}

export interface ConditionsDay {
  readonly date: string;
  readonly code: number;
  readonly snowCm: number;
  readonly minC: number;
  readonly maxC: number;
  readonly gustKmh: number;
  readonly precipChance: number | null;
  readonly sunrise: string | null;
  readonly sunset: string | null;
}

export interface Conditions {
  /** Where the model point sits above sea level — not the summit. */
  readonly elevationM: number | null;
  readonly now: ConditionsNow | null;
  readonly days: readonly ConditionsDay[];
  /** When Passport fetched it (ISO), set by the server. */
  readonly fetchedAt: string;
  readonly source: "Open-Meteo";
}

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const str = (v: unknown): string | null =>
  typeof v === "string" && v.length > 0 && v.length < 40 ? v : null;

/**
 * Raw Open-Meteo JSON → `Conditions`, or `null` if it is not what we asked
 * for. A forecast with holes in it is dropped day by day rather than guessed.
 */
export function parseConditions(
  raw: unknown,
  fetchedAt: string,
): Conditions | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const d = r.daily as Record<string, unknown> | undefined;
  if (!d || !Array.isArray(d.time)) return null;
  const col = (k: string): unknown[] =>
    Array.isArray(d[k]) ? (d[k] as unknown[]) : [];

  const days: ConditionsDay[] = [];
  (d.time as unknown[]).forEach((t, i) => {
    const date = str(t);
    const min = num(col("temperature_2m_min")[i]);
    const max = num(col("temperature_2m_max")[i]);
    const snow = num(col("snowfall_sum")[i]);
    const gust = num(col("wind_gusts_10m_max")[i]);
    const code = num(col("weather_code")[i]);
    if (
      !date ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      min === null ||
      max === null ||
      snow === null ||
      gust === null ||
      code === null
    )
      return;
    days.push({
      date,
      code,
      snowCm: snow,
      minC: min,
      maxC: max,
      gustKmh: gust,
      precipChance: num(col("precipitation_probability_max")[i]),
      sunrise: str(col("sunrise")[i]),
      sunset: str(col("sunset")[i]),
    });
  });
  if (days.length === 0) return null;

  const c = r.current as Record<string, unknown> | undefined;
  let now: ConditionsNow | null = null;
  if (c) {
    const time = str(c.time);
    const tempC = num(c.temperature_2m);
    const feels = num(c.apparent_temperature);
    const wind = num(c.wind_speed_10m);
    const gust = num(c.wind_gusts_10m);
    const code = num(c.weather_code);
    if (
      time &&
      tempC !== null &&
      feels !== null &&
      wind !== null &&
      gust !== null &&
      code !== null
    )
      now = {
        time,
        tempC,
        feelsLikeC: feels,
        windKmh: wind,
        gustKmh: gust,
        code,
        snowCmPerHour: num(c.snowfall) ?? 0,
      };
  }
  return {
    elevationM: num(r.elevation),
    now,
    days,
    fetchedAt,
    source: "Open-Meteo",
  };
}

/** WMO weather interpretation codes, in a person's words. */
export function skyWords(code: number): string {
  if (code === 0) return "clear";
  if (code === 1 || code === 2) return "mostly clear";
  if (code === 3) return "overcast";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if (code >= 61 && code <= 67) return "rain";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 80 && code <= 82) return "rain showers";
  if (code === 85 || code === 86) return "snow showers";
  if (code >= 95) return "thunderstorms";
  return "unsettled";
}

const r1 = (n: number) => Math.round(n);
const signed = (n: number) => `${n < 0 ? "−" : ""}${Math.abs(r1(n))}°`;

export function dayFor(c: Conditions, date: string): ConditionsDay | undefined {
  return c.days.find((x) => x.date === date);
}

export interface Headline {
  /** One short line a person reads at a glance. */
  readonly line: string;
  /** Things to do about it — gear, timing — each grounded in a number above. */
  readonly tips: readonly string[];
  /** True when the model says rain, not snow, at the valley point. */
  readonly wet: boolean;
}

/**
 * What a day's numbers mean for a day on snow. Conservative by design: it
 * never says conditions are *good*, because a model at a valley point cannot
 * know. It says what the numbers are and what to bring.
 */
export function headline(day: ConditionsDay): Headline {
  const tips: string[] = [];
  const wet = day.maxC > 1.5 && day.snowCm < 1 && day.code >= 51;
  const parts = [
    `${skyWords(day.code)}`,
    `${signed(day.minC)} to ${signed(day.maxC)}`,
  ];
  if (day.snowCm >= 0.5) parts.push(`${day.snowCm.toFixed(0)} cm of snow`);
  if (wet) parts.push("rain at the valley point");
  if (day.gustKmh >= 20) parts.push(`gusts to ${r1(day.gustKmh)} km/h`);

  if (day.minC <= -10)
    tips.push(
      `It gets down to ${signed(day.minC)} here and colder higher up: hand warmers, a neck gaiter, no bare skin on the lift.`,
    );
  if (wet)
    tips.push(
      "Wet weather: waterproof shell and a spare pair of gloves. Cotton gets cold fast.",
    );
  if (day.gustKmh >= 50)
    tips.push(
      `Gusts to ${r1(day.gustKmh)} km/h. Lifts can slow or close in wind. Check the resort's lift status before you drive up.`,
    );
  if (day.snowCm >= 15)
    tips.push(
      `${day.snowCm.toFixed(0)} cm forecast. Fresh snow means slower, deeper going, so plan an easier day and stay with your crew.`,
    );
  if (day.code === 45 || day.code === 48)
    tips.push(
      "Fog can cut visibility on the hill. Pick a meeting point you can find without seeing far.",
    );
  if (day.code >= 95)
    tips.push(
      "Thunderstorms in the forecast. Do not ride in one. Check with the resort.",
    );
  if (day.sunset)
    tips.push(
      `Sunset is about ${day.sunset.slice(11)}. Lifts usually stop before dark. Confirm closing time with the resort.`,
    );
  return { line: parts.join(" · "), tips, wet };
}

/** "Fresh snow over the next N days", from the days that have snow in them. */
export function snowAhead(c: Conditions, from: string, n = 3): number {
  return c.days
    .filter((d) => d.date >= from)
    .slice(0, n)
    .reduce((s, d) => s + d.snowCm, 0);
}

export function nowWords(n: ConditionsNow): string {
  const bits = [
    `${skyWords(n.code)}, ${signed(n.tempC)}`,
    n.feelsLikeC !== n.tempC ? `feels like ${signed(n.feelsLikeC)}` : null,
    `wind ${r1(n.windKmh)} km/h, gusts ${r1(n.gustKmh)}`,
  ].filter(Boolean);
  return bits.join(" · ");
}
