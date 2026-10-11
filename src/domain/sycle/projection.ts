/**
 * **The world as seen from YVR.**
 *
 * An azimuthal equidistant projection centred on Vancouver International. Two
 * properties make it the honest map for an arrival board, rather than merely a
 * pretty one:
 *
 * - **Every great-circle route into Vancouver is a straight line** from the
 *   origin to the centre. Flights converging on Vancouver is not a visual
 *   metaphor here; it is the geometry.
 * - **Distance from the centre is true distance from YVR.** The rings drawn on
 *   the board are real 2,000 km steps, so a dot's distance from the middle is a
 *   fact about how far that person has come.
 *
 * The cost is the rim: the antipode (the southern Indian Ocean) is smeared
 * around the circumference. Nobody is flying in from there.
 *
 * Pure and dependency-free on purpose — `d3-geo` is only in `node_modules`
 * transitively, and `package.json` is a shared contract.
 */

export const YVR = { latitude: 49.1947, longitude: -123.1792 } as const;

/** Radius of the drawn disc, in SVG units. The rim is 180° from YVR. */
export const DISC_RADIUS = 500;

const EARTH_KM = 6371.0088;
const RAD = Math.PI / 180;

export interface LatLon {
  readonly latitude: number;
  readonly longitude: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Angular distance between two points, in radians. */
export function angularDistance(a: LatLon, b: LatLon): number {
  const φ1 = a.latitude * RAD;
  const φ2 = b.latitude * RAD;
  const Δλ = (b.longitude - a.longitude) * RAD;
  const cos =
    Math.sin(φ1) * Math.sin(φ2) + Math.cos(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return Math.acos(Math.min(1, Math.max(-1, cos)));
}

export const greatCircleKm = (a: LatLon, b: LatLon): number =>
  angularDistance(a, b) * EARTH_KM;

/** SVG units per kilometre, for drawing distance rings. */
export const UNITS_PER_KM = DISC_RADIUS / (Math.PI * EARTH_KM);

/**
 * Project a point. SVG coordinates: origin at YVR, y grows downward, north up.
 */
export function project(p: LatLon, centre: LatLon = YVR): Point {
  const φ0 = centre.latitude * RAD;
  const φ = p.latitude * RAD;
  const Δλ = (p.longitude - centre.longitude) * RAD;
  const c = angularDistance(centre, p);
  if (c < 1e-9) return { x: 0, y: 0 };
  const k = c / Math.sin(c);
  const x = k * Math.cos(φ) * Math.sin(Δλ);
  const y =
    k *
    (Math.cos(φ0) * Math.sin(φ) - Math.sin(φ0) * Math.cos(φ) * Math.cos(Δλ));
  const scale = DISC_RADIUS / Math.PI;
  return { x: x * scale, y: -y * scale };
}

/**
 * The point a fraction `t` of the way along the great circle from `a` to `b`.
 *
 * Used for exactly one thing: placing an *estimated* aircraft along its route
 * from published times. The caller is responsible for labelling it as an
 * estimate — this function does not know, and must not be mistaken for, where
 * an aircraft actually is.
 */
export function alongGreatCircle(a: LatLon, b: LatLon, t: number): LatLon {
  const d = angularDistance(a, b);
  if (d < 1e-9) return a;
  const f = Math.min(1, Math.max(0, t));
  const A = Math.sin((1 - f) * d) / Math.sin(d);
  const B = Math.sin(f * d) / Math.sin(d);
  const φ1 = a.latitude * RAD;
  const λ1 = a.longitude * RAD;
  const φ2 = b.latitude * RAD;
  const λ2 = b.longitude * RAD;
  const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
  const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
  const z = A * Math.sin(φ1) + B * Math.sin(φ2);
  return {
    latitude: Math.atan2(z, Math.hypot(x, y)) / RAD,
    longitude: Math.atan2(y, x) / RAD,
  };
}
