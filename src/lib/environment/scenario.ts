import type { OctoberPlace } from "@/domain/environment/places";
import type { Environment, SkyCondition } from "@/domain/environment/types";

/**
 * **Simulated conditions, for development only.**
 *
 * We cannot wait for a cold clear night in order to find out what October does
 * on one. This produces a complete, internally consistent `Environment` for a
 * named scenario so every screen can be looked at under conditions that are
 * not today's.
 *
 * ## Impossible to mistake for real weather
 *
 * Three separate guards, because a simulated forecast reaching a real person
 * is the worst failure this file could have:
 *
 * 1. **It does not exist in production.** `scenarioFrom` returns `undefined`
 *    unless `NODE_ENV === "development"`, so the query parameter is inert in
 *    any deployed build.
 * 2. **It is loud.** `provenance.source` is `"SIMULATED — not real weather"`,
 *    and that string is what every surface renders as attribution, so any
 *    screen showing simulated data says so in its own copy.
 * 3. **It is never stored.** It comes from the URL and goes nowhere near the
 *    profile, the database, or a cookie. Closing the tab ends it.
 */

export const SCENARIOS = [
  "kelowna-sunny-afternoon",
  "kelowna-rainy-night",
  "kelowna-cold-clear-night",
  "vernon-clear-night",
  "vernon-rainy-evening",
  "halloween-cold-cloudy",
  "vernon-quiet-week",
  "draconid-final-weekend",
  "draconids-building",
  "draconids-clouded",
  "halloween-week",
] as const;

export type ScenarioName = (typeof SCENARIOS)[number];

export interface Scenario {
  readonly name: ScenarioName;
  /** The area this scenario is about — the page uses it instead of the profile. */
  readonly areaId: string;
  /** The instant the page should pretend it is. */
  readonly now: Date;
  readonly label: string;
}

interface Recipe {
  readonly areaId: string;
  readonly at: string;
  readonly sky: SkyCondition;
  readonly lowC: number;
  readonly highC: number;
  readonly pop: number;
  readonly label: string;
}

const RECIPES: Record<ScenarioName, Recipe> = {
  "kelowna-sunny-afternoon": {
    areaId: "kelowna",
    at: "2026-10-03T21:00:00Z", // 2 PM Saturday
    sky: "clear",
    lowC: 7,
    highC: 18,
    pop: 0,
    label: "Kelowna · sunny Saturday afternoon",
  },
  "kelowna-rainy-night": {
    areaId: "kelowna",
    at: "2026-10-03T03:00:00Z", // 8 PM Friday
    sky: "precipitating",
    lowC: 9,
    highC: 13,
    pop: 85,
    label: "Kelowna · rainy night",
  },
  "kelowna-cold-clear-night": {
    areaId: "kelowna",
    // Early October, where the corpus actually has outdoor things on. A
    // scenario dated to an empty week demonstrates nothing, which is what
    // the first pick at this did.
    at: "2026-10-03T04:00:00Z", // 9 PM Friday
    sky: "clear",
    lowC: 1,
    highC: 11,
    pop: 0,
    label: "Kelowna · cold clear night",
  },
  "vernon-clear-night": {
    areaId: "vernon",
    at: "2026-10-03T04:00:00Z",
    sky: "clear",
    lowC: 3,
    highC: 12,
    pop: 0,
    label: "Vernon · cold clear night",
  },
  "vernon-rainy-evening": {
    areaId: "vernon",
    at: "2026-10-03T02:00:00Z", // 7 PM Friday
    sky: "precipitating",
    lowC: 8,
    highC: 12,
    pop: 80,
    label: "Vernon · rainy evening",
  },
  // Mid-shower with a clear sky: the one state in which October is allowed
  // to let the sky onto the page. Two nights before the predicted peak.
  "draconids-building": {
    areaId: "vernon",
    at: "2026-10-08T03:00:00Z", // 8 PM Wednesday, Oct 7
    sky: "clear",
    lowC: 4,
    highC: 14,
    pop: 0,
    label: "Vernon · the Draconids building, clear sky",
  },
  // The same night, clouded out. Hype must refuse it: a meteor shower nobody
  // can see is not something to be excited about.
  "draconids-clouded": {
    areaId: "vernon",
    at: "2026-10-08T03:00:00Z",
    sky: "precipitating",
    lowC: 8,
    highC: 13,
    pop: 80,
    label: "Vernon · the Draconids, rained out",
  },
  // The best Don't Miss case the corpus holds: a 162-day farmers' market
  // season and a five-night meteor shower, both down to their last two days.
  "draconid-final-weekend": {
    areaId: "vernon",
    at: "2026-10-10T04:00:00Z", // 9 PM Friday, Oct 9
    sky: "clear",
    lowC: 3,
    highC: 14,
    pop: 0,
    label: "Vernon · the Draconids' final weekend",
  },
  // Late October, when the Halloween-night things are in range. Exists to
  // show the middle of the Hypometer rather than its extremes.
  "halloween-week": {
    areaId: "vernon",
    at: "2026-10-30T02:00:00Z", // 7 PM Thursday, Oct 29
    sky: "partly-cloudy",
    lowC: 3,
    highC: 11,
    pop: 10,
    label: "Vernon · Halloween week",
  },
  // Mid-October, when nothing in the corpus is closing. Exists so the
  // *absence* of Don't Miss can be looked at, which is as much a state as
  // its presence.
  "vernon-quiet-week": {
    areaId: "vernon",
    at: "2026-10-18T02:00:00Z", // 7 PM Saturday
    sky: "partly-cloudy",
    lowC: 5,
    highC: 13,
    pop: 10,
    label: "Vernon · a quiet week, nothing closing",
  },
  "halloween-cold-cloudy": {
    areaId: "vernon",
    at: "2026-11-01T01:00:00Z", // 6 PM, Oct 31
    sky: "mostly-cloudy",
    lowC: 2,
    highC: 8,
    pop: 20,
    label: "Vernon · Halloween, cold and cloudy",
  },
};

/** The banner every surface must render when this is on. */
export const SIMULATED_SOURCE = "SIMULATED — not real weather";

export function scenarioFrom(value: string | undefined): Scenario | undefined {
  // Guard one: inert anywhere but a developer's own machine.
  if (process.env.NODE_ENV !== "development") return undefined;
  if (!value) return undefined;
  const name = SCENARIOS.find((s) => s === value);
  if (!name) return undefined;
  const recipe = RECIPES[name];
  return {
    name,
    areaId: recipe.areaId,
    now: new Date(recipe.at),
    label: recipe.label,
  };
}

/**
 * A full week of invented conditions around the scenario's day, so every lane
 * and every detail page has something consistent to read.
 */
export function simulatedEnvironment(
  scenario: Scenario,
  area: OctoberPlace,
): Environment {
  // Note: in a scenario every area gets the same invented conditions, so a
  // Vernon event seen from Kelowna also has something to read. That is a
  // development convenience and is exactly the kind of thing the real
  // provider must never do — which is why it lives here and is labelled.
  const recipe = RECIPES[scenario.name];
  const day0 = scenario.now.toISOString().slice(0, 10);

  const hourly = [];
  for (let h = -12; h <= 36; h++) {
    const at = new Date(scenario.now.getTime() + h * 3_600_000);
    const localHour = Number(
      new Intl.DateTimeFormat("en-CA", {
        hour: "numeric",
        hour12: false,
        timeZone: "America/Vancouver",
      }).format(at),
    );
    const daytime = localHour >= 9 && localHour < 18;
    hourly.push({
      at: at.toISOString(),
      sky: recipe.sky,
      description: "(simulated)",
      temperatureC: daytime ? recipe.highC : recipe.lowC,
      precipitationChance: recipe.pop,
    });
  }

  const nights = [];
  for (let d = -1; d <= 5; d++) {
    const date = new Date(`${day0}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + d);
    nights.push({
      day: date.toISOString().slice(0, 10),
      sky: recipe.sky,
      description: "(simulated)",
      lowC: recipe.lowC,
      precipitationChance: recipe.pop,
    });
  }

  return {
    area,
    hourly,
    nights,
    provenance: {
      // Guard two: the attribution every surface renders says what this is.
      source: SIMULATED_SOURCE,
      stationName: area.name.replace(/,\s*BC$/i, ""),
      issuedAt: scenario.now.toISOString(),
      fetchedAt: scenario.now.toISOString(),
    },
  };
}
