/**
 * **Spherical geometry for one question: is that aircraft on this route?**
 *
 * Pure and dependency-free. Nothing here produces an aircraft position; it
 * only measures positions that ADS-B reported, against airports, and draws
 * the planned route as a line. The caller labels a drawn route as planned.
 */

export interface LatLon {
  readonly lat: number;
  readonly lon: number;
}

const EARTH_KM = 6371.0088;
const RAD = Math.PI / 180;

/** Angular distance in radians. */
function angle(a: LatLon, b: LatLon): number {
  const φ1 = a.lat * RAD;
  const φ2 = b.lat * RAD;
  const Δφ = φ2 - φ1;
  const Δλ = (b.lon - a.lon) * RAD;
  const h =
    Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const distanceKm = (a: LatLon, b: LatLon): number =>
  angle(a, b) * EARTH_KM;

/** Initial bearing from `a` to `b`, degrees clockwise from true north. */
export function bearingDeg(a: LatLon, b: LatLon): number {
  const φ1 = a.lat * RAD;
  const φ2 = b.lat * RAD;
  const Δλ = (b.lon - a.lon) * RAD;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}

/** Smallest difference between two headings, 0–180. */
export function headingGap(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * Where `p` sits relative to the great circle from `from` to `to`: how far
 * off it (cross-track) and how far along it (along-track), in km.
 */
export function relativeToRoute(
  p: LatLon,
  from: LatLon,
  to: LatLon,
): { crossKm: number; alongKm: number; routeKm: number } {
  const routeKm = distanceKm(from, to);
  const δ13 = angle(from, p);
  const θ13 = bearingDeg(from, p) * RAD;
  const θ12 = bearingDeg(from, to) * RAD;
  const δxt = Math.asin(Math.sin(δ13) * Math.sin(θ13 - θ12));
  const cos = Math.cos(δ13) / Math.cos(δxt);
  let δat = Math.acos(Math.min(1, Math.max(-1, cos)));
  // Behind the departure airport counts as negative progress.
  if (Math.cos(θ13 - θ12) < 0) δat = -δat;
  return {
    crossKm: Math.abs(δxt) * EARTH_KM,
    alongKm: δat * EARTH_KM,
    routeKm,
  };
}

/**
 * Points along the great circle, for drawing the planned route as a line.
 * Longitudes are unwrapped so a line across the antimeridian stays one line.
 */
export function greatCirclePath(
  from: LatLon,
  to: LatLon,
  steps = 64,
): [number, number][] {
  const d = angle(from, to);
  if (d < 1e-9) return [[from.lon, from.lat]];
  const φ1 = from.lat * RAD;
  const λ1 = from.lon * RAD;
  const φ2 = to.lat * RAD;
  const λ2 = to.lon * RAD;
  const out: [number, number][] = [];
  let previous: number | null = null;
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
    const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
    const z = A * Math.sin(φ1) + B * Math.sin(φ2);
    let lon = Math.atan2(y, x) / RAD;
    if (previous !== null) {
      while (lon - previous > 180) lon -= 360;
      while (lon - previous < -180) lon += 360;
    }
    previous = lon;
    out.push([lon, Math.atan2(z, Math.hypot(x, y)) / RAD]);
  }
  return out;
}

/**
 * A ring `km` from `centre`, as `[lon, lat]` points, closed. Drawn around the
 * conference's airport as distance rings: geometry, never a position.
 */
export function ringAround(
  centre: LatLon,
  km: number,
  steps = 96,
): [number, number][] {
  const δ = km / EARTH_KM;
  const φ1 = centre.lat * RAD;
  const λ1 = centre.lon * RAD;
  const out: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const θ = (i / steps) * 2 * Math.PI;
    const φ2 = Math.asin(
      Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ),
    );
    const λ2 =
      λ1 +
      Math.atan2(
        Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
        Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2),
      );
    out.push([λ2 / RAD, φ2 / RAD]);
  }
  return out;
}
