import { daylightAt, moonIllumination } from "@/domain/environment/daylight";
import {
  ageInHours,
  hoursBetween,
  type Environment,
} from "@/domain/environment/types";
import type { SubjectKind } from "./subjectKind";

/**
 * **What the conditions mean for this particular thing.**
 *
 * The previous version pasted one forecast sentence onto whatever was
 * outdoors, which is why it read as decoration. The interpretation has to
 * depend on what the thing *is*, because the same Tuesday evening is four
 * different facts:
 *
 * ```
 * a haunted trail      7°C and dry      →  bring a coat, it is a good night
 * a pumpkin patch      7°C and dry      →  says nothing, it is 9pm
 * a meteor shower      7°C and dry      →  the temperature is irrelevant;
 *                                          is the sky empty, is there a moon
 * a hockey game        7°C and dry      →  silence
 * ```
 *
 * ## The three refusals are unchanged
 *
 * No forecast, no sentence. No stale forecast. No conclusion the data does not
 * carry — never "cancelled", never "unsuitable", never a promise that anybody
 * will see a meteor.
 */

const STALE_AFTER_HOURS = 6;

/** Evening into the small hours, local. */
const NIGHT = { from: 19, to: 2 } as const;
/** The part of a day somebody goes to a farm in. */
const DAY = { from: 10, to: 17 } as const;

export interface ConditionRead {
  /** What a person reads. One or two short sentences. */
  readonly line: string;
  /** The facts behind it — "7°C · dry · dark by 6:35". Scannable. */
  readonly facts?: string;
  /** For ordering and for styling: does this change a plan? */
  readonly weight: "good" | "notable" | "warning";
  readonly source: string;
  /** The forecast city, when it is not the subject's own town. */
  readonly via?: string;
}

/** Local-hour window on a day, as UTC instants. PDT through October. */
function windowOn(day: string, from: number, to: number) {
  const base = Date.parse(`${day}T00:00:00Z`);
  const start = new Date(base);
  start.setUTCHours(from + 7);
  const end = new Date(base);
  if (to <= from) end.setUTCDate(end.getUTCDate() + 1);
  end.setUTCHours(to + 7);
  return { from: start.toISOString(), to: end.toISOString() };
}

const OPEN = new Set(["clear", "mainly-clear"]);

interface Slice {
  readonly openShare?: number;
  readonly wettest: number;
  readonly lowC?: number;
  readonly highC?: number;
  readonly from: string;
}

/**
 * The forecast for one window, from hourly where it reaches and the night
 * summary where it does not. Both are real; neither is invented from the other.
 */
function sliceFor(
  reading: Environment,
  day: string,
  span: { from: number; to: number },
): Slice | undefined {
  const { from, to } = windowOn(day, span.from, span.to);
  const hours = hoursBetween(reading, from, to);

  if (hours.length > 0) {
    const known = hours.filter((h) => h.sky !== "unknown");
    const temps = hours
      .map((h) => h.temperatureC)
      .filter((t): t is number => t !== undefined);
    return {
      openShare: known.length
        ? known.filter((h) => OPEN.has(h.sky)).length / known.length
        : undefined,
      wettest: hours.reduce(
        (m, h) => Math.max(m, h.precipitationChance ?? 0),
        0,
      ),
      lowC: temps.length ? Math.min(...temps) : undefined,
      highC: temps.length ? Math.max(...temps) : undefined,
      from,
    };
  }

  // Night summaries only describe nights. A daytime window has no fallback,
  // and saying nothing is the honest outcome.
  if (span.from < 12) return undefined;
  const summary = reading.nights.find((n) => n.day === day);
  if (!summary || summary.sky === "unknown") return undefined;
  return {
    openShare: OPEN.has(summary.sky) ? 1 : 0,
    wettest:
      summary.precipitationChance ?? (summary.sky === "precipitating" ? 70 : 0),
    lowC: summary.lowC,
    from,
  };
}

function usable(
  environment: Environment | undefined,
  now: Date,
): Environment | undefined {
  if (!environment) return undefined;
  return ageInHours(environment, now) <= STALE_AFTER_HOURS
    ? environment
    : undefined;
}

const clock = (at: Date, timeZone: string) =>
  at
    .toLocaleTimeString("en-CA", {
      hour: "numeric",
      minute: "2-digit",
      timeZone,
    })
    .replace(/\s?([ap])\.?m\.?/i, (_, p: string) => ` ${p.toUpperCase()}M`);

const via = (reading: Environment): string | undefined => {
  const station = reading.provenance.stationName;
  if (!station) return undefined;
  const town = reading.area.name.replace(/,\s*BC$/i, "").trim();
  return station.toLowerCase() === town.toLowerCase() ? undefined : station;
};

/**
 * **The interpretation, for one subject on one day.**
 *
 * Returns nothing far more often than it returns something — an indoor thing
 * on an ordinary day, anything outside the forecast horizon, and every subject
 * nobody has classified.
 */
export function conditionsFor(
  kind: SubjectKind,
  day: string,
  environment: Environment | undefined,
  now: Date,
  options: {
    /**
     * **Where this will be rendered, which decides whether indoor speaks.**
     *
     * On a card: never. A wet Tuesday is one fact about the evening, and
     * printing "good night to be indoors" under all five indoor things in a
     * lane is the wallpaper this whole module exists to avoid — measured on
     * the rainy-night scenario, where it appeared on five of six rows.
     *
     * On a page or a subject's own briefing: once, where it is the point.
     */
    readonly surface?: "card" | "page";
    readonly timeZone?: string;
  } = {},
): ConditionRead | undefined {
  const { surface = "card", timeZone = "America/Vancouver" } = options;
  const reading = usable(environment, now);
  if (!reading) return undefined;
  if (kind === "unknown") return undefined;

  const source = reading.provenance.source;
  const station = via(reading);
  const common = { source, ...(station ? { via: station } : {}) };

  const dark = daylightAt(
    reading.area.latitude,
    reading.area.longitude,
    new Date(`${day}T20:00:00Z`),
  );
  const darkAt = dark ? clock(dark.sunset, timeZone) : undefined;

  // ---------------------------------------------------------- A. ASTRONOMY
  if (kind === "astronomy") {
    const night = sliceFor(reading, day, NIGHT);
    if (!night || night.openShare === undefined) return undefined;
    const lit = moonIllumination(new Date(night.from));
    const moon =
      lit < 0.2 ? "almost no moon" : lit > 0.75 ? "a bright moon" : undefined;
    const facts = [
      darkAt ? `dark by ${darkAt}` : undefined,
      moon,
      night.lowC !== undefined ? `${Math.round(night.lowC)}°C` : undefined,
    ]
      .filter(Boolean)
      .join(" · ");

    if (night.wettest >= 60) {
      return {
        line: "Rain forecast after dark. Not a sky night.",
        facts,
        weight: "warning",
        ...common,
      };
    }
    if (night.openShare >= 0.7) {
      return {
        line:
          lit > 0.75
            ? "Clear after dark, but the moon is bright."
            : "Clear after dark. This might actually cooperate.",
        facts,
        weight: "good",
        ...common,
      };
    }
    if (night.openShare >= 0.35) {
      return {
        line: "In and out of cloud after dark.",
        facts,
        weight: "notable",
        ...common,
      };
    }
    return {
      line: "Forecast cloudy after dark.",
      facts,
      weight: "warning",
      ...common,
    };
  }

  // ------------------------------------------------------ B. OUTDOOR NIGHT
  if (kind === "outdoor-night") {
    const night = sliceFor(reading, day, NIGHT);
    if (!night) return undefined;
    const facts = [
      night.lowC !== undefined ? `${Math.round(night.lowC)}°C` : undefined,
      night.wettest >= 60 ? "rain likely" : "dry",
      darkAt ? `dark by ${darkAt}` : undefined,
    ]
      .filter(Boolean)
      .join(" · ");

    if (night.wettest >= 60) {
      return {
        line: "Rain likely after dark.",
        facts,
        weight: "warning",
        ...common,
      };
    }
    if (night.lowC !== undefined && night.lowC <= 4) {
      return {
        line: "Cold after dark. Bring a jacket.",
        facts,
        weight: "notable",
        ...common,
      };
    }
    return { line: "Dry after dark.", facts, weight: "good", ...common };
  }

  // -------------------------------------------------------- C. OUTDOOR DAY
  if (kind === "outdoor-day") {
    const daytime = sliceFor(reading, day, DAY);
    if (!daytime) return undefined;
    const facts = [
      daytime.highC !== undefined
        ? `${Math.round(daytime.highC)}°C`
        : undefined,
      daytime.wettest >= 50 ? "showers possible" : "dry",
    ]
      .filter(Boolean)
      .join(" · ");

    if (daytime.wettest >= 50) {
      return {
        line: "Showers possible during the day.",
        facts,
        weight: "warning",
        ...common,
      };
    }
    if (daytime.highC !== undefined && daytime.highC >= 12) {
      return {
        line: "Good weather for being outside.",
        facts,
        weight: "good",
        ...common,
      };
    }
    return {
      line: "Dry, but cold for standing about.",
      facts,
      weight: "notable",
      ...common,
    };
  }

  // ------------------------------------------------------------- D. INDOOR
  //
  // Silent on a card, always. On a page, silent unless the evening is
  // genuinely miserable — then one short sentence, no forecast attached,
  // because being indoors has become the point rather than an irrelevance.
  if (surface !== "page") return undefined;
  const night = sliceFor(reading, day, NIGHT);
  if (!night) return undefined;
  const miserable =
    night.wettest >= 60 || (night.lowC !== undefined && night.lowC <= 0);
  if (!miserable) return undefined;
  return {
    line:
      night.wettest >= 60
        ? "Wet night out there. Good night to be indoors."
        : "Freezing out there. Good night to be indoors.",
    weight: "notable",
    ...common,
  };
}
