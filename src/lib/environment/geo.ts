/**
 * **Distance between two points on the earth.**
 *
 * Its own module because two unrelated things need it and neither should
 * import the other: the Environment Canada adapter ranks candidate forecast
 * cities, and October ranks what is near enough to go to. Putting it in the
 * adapter made the domain depend on a provider, which is backwards.
 *
 * Haversine, which is accurate to a fraction of a percent at these distances
 * and does not pretend to be a road.
 */
export function distanceKm(
  a: { readonly latitude: number; readonly longitude: number },
  b: { readonly latitude: number; readonly longitude: number },
): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}
