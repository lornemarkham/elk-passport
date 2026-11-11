import { metres } from "./actions";
import type { FeatureId, Kind, LatLng } from "./model";

/**
 * **Build My Christmas Lights Tour** — a practical evening through lit
 * displays, from where a family is, in the time they have.
 *
 * Distances are straight lines stretched by a road factor and timed at an
 * honest town speed; the page says it is an estimate and hands the real
 * route to the family's own map app. Pure.
 */

export type Mode = "drive" | "walk";

export interface Stop {
  readonly id: string;
  readonly name: string;
  readonly at: LatLng;
  readonly kind: Kind | "atlas";
  /** For Atlas finds: what it is in Atlas's words ("Christmas market"). */
  readonly label?: string;
  readonly features?: readonly FeatureId[];
  /** Community love: total reactions. */
  readonly love?: number;
  /** Minutes to enjoy it, when someone stated it. */
  readonly minutes?: number;
}

export interface TourAsk {
  readonly from: LatLng;
  readonly mode: Mode;
  /** Minutes the family has, start to last stop. */
  readonly minutes: number;
  readonly stops: number;
  /** Preferred, never required: a stop without the fact is not excluded. */
  readonly prefer: readonly FeatureId[];
  /** Include markets and festive Atlas finds alongside the lights. */
  readonly festive: boolean;
}

export interface Leg {
  readonly km: number;
  readonly minutes: number;
}

export interface TimedStop {
  readonly stop: Stop;
  readonly leg: Leg;
  readonly stay: number;
  /** Minutes from setting out when the family arrives. */
  readonly arrive: number;
}

export interface Tour {
  readonly from: LatLng;
  readonly mode: Mode;
  readonly stops: readonly TimedStop[];
  readonly minutes: number;
  readonly km: number;
  /** Over the time asked for. A built tour never is; an edited one may be. */
  readonly over: boolean;
  /** Candidates in reach that didn't fit. */
  readonly leftOut: number;
}

const ROAD = { drive: 1.35, walk: 1.2 } as const;
const KMH = { drive: 35, walk: 4.5 } as const;
/** Parking, crossing, getting the kids back in. */
const PER_LEG = { drive: 2, walk: 0 } as const;
/** How far a tour reaches from its start, straight line. */
export const REACH_KM = { drive: 25, walk: 2.5 } as const;

const STAY: Record<Stop["kind"], number> = {
  home: 5,
  "public-display": 15,
  neighbourhood: 15,
  "community-tree": 10,
  market: 40,
  "festive-attraction": 45,
  atlas: 30,
};

export function stayAt(stop: Stop, mode: Mode): number {
  if (stop.minutes) return stop.minutes;
  const base = STAY[stop.kind];
  if (mode === "drive" && stop.features?.includes("drive-by"))
    return Math.min(base, 4);
  return base;
}

export function leg(a: LatLng, b: LatLng, mode: Mode): Leg {
  const km = (metres(a, b) / 1000) * ROAD[mode];
  return {
    km: Math.round(km * 10) / 10,
    minutes: Math.max(1, Math.round((km / KMH[mode]) * 60 + PER_LEG[mode])),
  };
}

/** Time a tour in the order given. */
export function timeTour(
  from: LatLng,
  mode: Mode,
  stops: readonly Stop[],
  budget = Infinity,
  leftOut = 0,
): Tour {
  let here = from;
  let clock = 0;
  let km = 0;
  const timed: TimedStop[] = [];
  for (const stop of stops) {
    const l = leg(here, stop.at, mode);
    clock += l.minutes;
    km += l.km;
    const stay = stayAt(stop, mode);
    timed.push({ stop, leg: l, stay, arrive: clock });
    clock += stay;
    here = stop.at;
  }
  return {
    from,
    mode,
    stops: timed,
    minutes: clock,
    km: Math.round(km * 10) / 10,
    over: clock > budget,
    leftOut,
  };
}

function pathKm(from: LatLng, stops: readonly Stop[]): number {
  let here = from;
  let total = 0;
  for (const s of stops) {
    total += metres(here, s.at);
    here = s.at;
  }
  return total;
}

/** Nearest next, from the start. */
function nearestOrder(from: LatLng, stops: readonly Stop[]): Stop[] {
  const left = [...stops];
  const out: Stop[] = [];
  let here = from;
  while (left.length) {
    let bi = 0;
    for (let i = 1; i < left.length; i++)
      if (metres(here, left[i]!.at) < metres(here, left[bi]!.at)) bi = i;
    const next = left.splice(bi, 1)[0]!;
    out.push(next);
    here = next.at;
  }
  return out;
}

/** Uncross the path: reverse any stretch that makes it shorter (2-opt). */
export function untangle(from: LatLng, stops: readonly Stop[]): Stop[] {
  let best = [...stops];
  let bestKm = pathKm(from, best);
  for (let improved = true, rounds = 0; improved && rounds < 50; rounds++) {
    improved = false;
    for (let i = 0; i < best.length - 1; i++) {
      for (let j = i + 1; j < best.length; j++) {
        const next = [
          ...best.slice(0, i),
          ...best.slice(i, j + 1).reverse(),
          ...best.slice(j + 1),
        ];
        const k = pathKm(from, next);
        if (k + 1 < bestKm) {
          best = next;
          bestKm = k;
          improved = true;
        }
      }
    }
  }
  return best;
}

/** Order stops into a sensible path from the start. */
export function order(from: LatLng, stops: readonly Stop[]): Stop[] {
  return untangle(from, nearestOrder(from, stops));
}

/**
 * **The tour.** In reach for the mode; the most loved and preferred first
 * among those close by; ordered into a path; then the least loved dropped
 * until it fits the time. At most two festive (Atlas) stops, so it stays a
 * lights tour.
 */
export function buildTour(ask: TourAsk, candidates: readonly Stop[]): Tour {
  const reach = REACH_KM[ask.mode] * 1000;
  const inReach = candidates.filter(
    (c) =>
      metres(ask.from, c.at) <= reach &&
      (ask.festive || c.kind === "home" || isLights(c)),
  );
  const score = (s: Stop) => {
    const km = metres(ask.from, s.at) / 1000;
    const love = Math.log2(1 + (s.love ?? 0));
    const liked = ask.prefer.filter((p) => s.features?.includes(p)).length;
    return love + liked * 1.5 - km / (ask.mode === "walk" ? 0.5 : 4);
  };
  const ranked = [...inReach].sort((a, b) => score(b) - score(a));
  const picked: Stop[] = [];
  let festive = 0;
  for (const s of ranked) {
    if (picked.length >= ask.stops) break;
    if (!isLights(s) && s.kind !== "home") {
      if (festive >= 2) continue;
      festive++;
    }
    picked.push(s);
  }
  let chosen = order(ask.from, picked);
  while (
    chosen.length > 1 &&
    timeTour(ask.from, ask.mode, chosen).minutes > ask.minutes
  ) {
    const weakest = [...chosen].sort((a, b) => score(a) - score(b))[0]!;
    chosen = order(
      ask.from,
      chosen.filter((s) => s !== weakest),
    );
  }
  if (
    chosen.length === 1 &&
    timeTour(ask.from, ask.mode, chosen).minutes > ask.minutes
  )
    chosen = [];
  return timeTour(
    ask.from,
    ask.mode,
    chosen,
    ask.minutes,
    inReach.length - chosen.length,
  );
}

const isLights = (s: Stop) =>
  s.kind === "public-display" ||
  s.kind === "neighbourhood" ||
  s.kind === "community-tree";

// ---------------------------------------------------------------------------
// Leaving the page

/**
 * Directions in the family's own map app. Google Maps' public URL scheme:
 * no key, works on every phone; at most nine waypoints between start and
 * end, so a longer tour opens as its first eleven places.
 */
export function directionsUrl(
  from: LatLng,
  mode: Mode,
  points: readonly LatLng[],
): string | null {
  const pts = points.slice(0, 10);
  if (pts.length === 0) return null;
  const fmt = (p: LatLng) => `${p.lat},${p.lng}`;
  const u = new URL("https://www.google.com/maps/dir/");
  u.searchParams.set("api", "1");
  u.searchParams.set("origin", fmt(from));
  u.searchParams.set("destination", fmt(pts[pts.length - 1]!));
  if (pts.length > 1)
    u.searchParams.set("waypoints", pts.slice(0, -1).map(fmt).join("|"));
  u.searchParams.set("travelmode", mode === "walk" ? "walking" : "driving");
  return u.toString();
}

export interface TourLink {
  readonly from: LatLng;
  readonly mode: Mode;
  readonly stops: readonly string[];
  readonly minutes?: number;
}

const ID = /^[a-z0-9:_-]{1,80}$/i;

/** A tour as a link anyone can open, no account needed. */
export function tourQuery(t: TourLink): string {
  const q = new URLSearchParams();
  q.set("from", `${t.from.lat.toFixed(4)},${t.from.lng.toFixed(4)}`);
  q.set("mode", t.mode);
  if (t.minutes) q.set("time", String(t.minutes));
  q.set("stops", t.stops.join("~"));
  return q.toString();
}

export function readTourQuery(
  params: Record<string, string | string[] | undefined>,
): TourLink | null {
  const one = (k: string) => {
    const v = params[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const stops = (one("stops") ?? "")
    .split("~")
    .filter((s) => ID.test(s))
    .slice(0, 20);
  const [lat, lng] = (one("from") ?? "").split(",").map(Number);
  if (!stops.length || !Number.isFinite(lat) || !Number.isFinite(lng))
    return null;
  const minutes = Number(one("time"));
  return {
    from: { lat: lat!, lng: lng! },
    mode: one("mode") === "walk" ? "walk" : "drive",
    stops,
    ...(minutes > 0 && minutes <= 600 ? { minutes } : {}),
  };
}

export function clockText(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}
