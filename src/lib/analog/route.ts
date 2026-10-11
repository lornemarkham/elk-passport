import type { DayPlanned } from "@/domain/day/build";
import type { Experience } from "@/domain/experience/types";
import { distanceKm } from "@/lib/environment/geo";

/**
 * **How you get from one stop to the next, on paper, and what is allowed to
 * be said about it.**
 *
 * Two different facts, kept apart the way `src/lib/routing/journey.ts` on the
 * maps lane keeps them apart (Atlas ADR 097):
 *
 * ```
 * straight line  km between two points Atlas has placed. A lower bound on the
 *                road, never an estimate of it, and never turned into minutes
 * routed         a routing provider's minutes and road km, from Atlas, with
 *                the provider named. Printed only when one is handed in
 * ```
 *
 * Nothing in this file has a speed in it. A leg with no routed answer prints
 * kilometres, or nothing, and a blank for the time somebody actually took.
 *
 * ## Legs are measured here, not read off the day
 *
 * `DayStop.km` is measured from the last stop *that had a position*: when
 * stop 2 is unplaced, stop 3's km is from stop 1. On a page that says "from
 * the last stop" that is a wrong sentence, so the legs are measured again
 * between the two ends actually printed, and a leg with an unplaced end has
 * no distance.
 */

export interface PrintPoint {
  readonly latitude: number;
  readonly longitude: number;
}

/**
 * A routed answer for one leg, in the shape of the `routed` arm of `Journey`
 * on the maps lane, so that one passes for this without either importing the
 * other.
 */
export interface RoutedTravel {
  readonly kind: "routed";
  readonly mode: string;
  /** Whole minutes, the provider's estimate. */
  readonly minutes: number;
  readonly roadKm: number;
  readonly provider: string;
}

export interface PrintLeg {
  /** The stop id it arrives at, or `home`. */
  readonly id: string;
  readonly from: string;
  readonly to: string;
  /** The number of the stop it arrives at. Absent for the way home. */
  readonly toNumber?: number;
  readonly home?: boolean;
  /** Straight-line km. Absent when either end has no position. */
  readonly km?: number;
  readonly routed?: RoutedTravel;
}

export interface SketchPoint {
  readonly label: string;
  /** Stop number. Absent for where the day starts. */
  readonly number?: number;
  readonly x: number;
  readonly y: number;
}

/**
 * **A sketch, not a map.** Points where Atlas placed them, joined in order by
 * straight lines, with north up and a scale. No roads, no water, no terrain:
 * Passport has none of them, and a drawn road that is not a road is worse
 * than a blank.
 */
export interface RouteSketch {
  readonly width: number;
  readonly height: number;
  readonly points: readonly SketchPoint[];
  /** Whether the line returns to the start. */
  readonly loops: boolean;
  readonly scale: { readonly km: number; readonly px: number };
}

export interface RouteSummary {
  /** Where the day sets out from, where it says. */
  readonly start?: string;
  readonly legs: readonly PrintLeg[];
  /** Absent when fewer than two points are placed. */
  readonly sketch?: RouteSketch;
  /** Stops that are not on the sketch because Atlas has not placed them. */
  readonly unplaced: readonly string[];
  /** Credit for every routing provider whose time is printed. */
  readonly attribution: readonly string[];
}

export const pointOf = (experience: Experience): PrintPoint | undefined => {
  const c = experience.geography?.coordinates;
  return c ? { latitude: c[1], longitude: c[0] } : undefined;
};

const round1 = (km: number) => Math.round(km * 10) / 10;

export interface RouteOptions {
  /**
   * Routed answers, keyed by the leg's `id`: the stop it arrives at, or
   * `home`. Whatever is not here prints as a straight line or nothing.
   */
  readonly travel?: Readonly<Record<string, RoutedTravel>>;
  /**
   * The credit lines the caller's routing code produced
   * (`attributionFor` on the maps lane). When routed times are printed and
   * none is given, the provider is credited by name.
   */
  readonly attribution?: readonly string[];
}

/** The legs of the day: from the start, between stops, and home again. */
export function legsFor(
  day: DayPlanned,
  { travel = {} }: RouteOptions = {},
): PrintLeg[] {
  const town = day.brief.town;
  const start = town ? town.name.replace(/,\s*BC$/, "") : undefined;
  const origin: PrintPoint | undefined = town
    ? { latitude: town.latitude, longitude: town.longitude }
    : undefined;

  const legs: PrintLeg[] = [];
  let fromName = start;
  let fromPoint = origin;
  day.stops.forEach((stop, index) => {
    const here = pointOf(stop.experience);
    const id = stop.experience.id;
    if (fromName !== undefined) {
      const routed = travel[id];
      legs.push({
        id,
        from: fromName,
        to: stop.experience.title,
        toNumber: index + 1,
        ...(fromPoint && here
          ? { km: round1(distanceKm(fromPoint, here)) }
          : {}),
        ...(routed ? { routed } : {}),
      });
    }
    fromName = stop.experience.title;
    fromPoint = here;
  });

  const last = day.stops[day.stops.length - 1];
  if (start && last) {
    const here = pointOf(last.experience);
    const routed = travel.home;
    legs.push({
      id: "home",
      from: last.experience.title,
      to: start,
      home: true,
      ...(origin && here ? { km: round1(distanceKm(here, origin)) } : {}),
      ...(routed ? { routed } : {}),
    });
  }
  return legs;
}

const NICE_KM = [0.5, 1, 2, 5, 10, 20, 50, 100, 200];

/**
 * Lay the placed points out with north up and true proportions: longitude
 * shrunk by the cosine of the latitude, the same flattening a paper map of a
 * small area makes. Good to well under a percent across a day's driving.
 */
export function sketchFor(
  places: readonly { label: string; number?: number; at: PrintPoint }[],
  loops: boolean,
  { width = 640, height = 300, pad = 36 } = {},
): RouteSketch | undefined {
  if (places.length < 2) return undefined;
  const meanLat =
    places.reduce((sum, p) => sum + p.at.latitude, 0) / places.length;
  const k = Math.cos((meanLat * Math.PI) / 180);
  const raw = places.map((p) => ({
    ...p,
    u: p.at.longitude * k,
    v: -p.at.latitude,
  }));
  const minU = Math.min(...raw.map((p) => p.u));
  const maxU = Math.max(...raw.map((p) => p.u));
  const minV = Math.min(...raw.map((p) => p.v));
  const maxV = Math.max(...raw.map((p) => p.v));
  // Points on top of each other still need a scale to draw at: ~1 km.
  const spanU = Math.max(maxU - minU, 0.009);
  const spanV = Math.max(maxV - minV, 0.009);
  const unit = Math.min((width - 2 * pad) / spanU, (height - 2 * pad) / spanV);
  const midU = (minU + maxU) / 2;
  const midV = (minV + maxV) / 2;

  // One degree of latitude is 111.2 km; a unit here is one degree.
  const pxPerKm = unit / 111.2;
  const target = width / 4 / pxPerKm;
  const km = [...NICE_KM].reverse().find((n) => n <= target) ?? NICE_KM[0]!;

  return {
    width,
    height,
    loops,
    points: raw.map((p) => ({
      label: p.label,
      ...(p.number !== undefined ? { number: p.number } : {}),
      x: Math.round(((p.u - midU) * unit + width / 2) * 10) / 10,
      y: Math.round(((p.v - midV) * unit + height / 2) * 10) / 10,
    })),
    scale: { km, px: Math.round(km * pxPerKm * 10) / 10 },
  };
}

export function routeFor(
  day: DayPlanned,
  options: RouteOptions = {},
): RouteSummary {
  const legs = legsFor(day, options);
  const town = day.brief.town;
  const start = town ? town.name.replace(/,\s*BC$/, "") : undefined;

  const placed: { label: string; number?: number; at: PrintPoint }[] = [];
  if (town && start) {
    placed.push({
      label: start,
      at: { latitude: town.latitude, longitude: town.longitude },
    });
  }
  const unplaced: string[] = [];
  day.stops.forEach((stop, index) => {
    const at = pointOf(stop.experience);
    if (at)
      placed.push({ label: stop.experience.title, number: index + 1, at });
    else unplaced.push(stop.experience.title);
  });
  // The line goes home only when it started somewhere and every stop is on it.
  const sketch = sketchFor(placed, Boolean(town) && unplaced.length === 0);

  const routedProviders = [
    ...new Set(legs.flatMap((l) => (l.routed ? [l.routed.provider] : []))),
  ];
  const attribution =
    routedProviders.length === 0
      ? []
      : options.attribution && options.attribution.length > 0
        ? [...options.attribution]
        : routedProviders.map((p) => `Travel times by ${p}`);

  return {
    ...(start ? { start } : {}),
    legs,
    ...(sketch ? { sketch } : {}),
    unplaced,
    attribution,
  };
}
