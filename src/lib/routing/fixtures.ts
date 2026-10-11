/**
 * **Atlas answers, as Atlas would send them** — test fixtures only.
 *
 * The numbers are not invented. They are Atlas's own probe of the OSRM demo
 * from Vernon on 2026-10-11 (`elk-atlas`,
 * `acceptance/real-world-geography/travel-time-probe.txt`), wrapped in the
 * reading shape of `src/application/travel/travelTime.ts`. The limitations are
 * `OsrmTravelTimeProvider`'s, word for word. Ids are placeholders: the probe
 * named places, not subjects.
 *
 * Kept beside the adapter rather than inside a test so the hook, the route and
 * the component can all be tested against the same Atlas.
 */

export const VERNON = { latitude: 50.27, longitude: -119.27 } as const;

const PROVIDER = "osrm-demo";
const AT = "2026-10-11T17:04:12.000Z";
const LIMITATIONS = [
  "free-flow road speeds from OpenStreetMap: no live or typical traffic",
  "no time for parking, ferries waiting, or road closures",
  "road network © OpenStreetMap contributors (ODbL), routed by OSRM",
];

const estimated = (minutes: number, routeKm: number, straightKm: number) => ({
  state: "estimated",
  mode: "driving",
  minutes,
  routeKm,
  straightKm,
  provider: PROVIDER,
  calculatedAt: AT,
  limitations: LIMITATIONS,
});

/** Driving from Vernon, served the way ADR 097 recommends. */
export const DRIVING_FROM_VERNON = {
  candidates: [
    {
      id: "davison-orchards",
      distance: { state: "measured", km: 2.2, basis: "coordinates" },
      travel: estimated(9, 4.5, 2.2),
    },
    {
      id: "okeefe-ranch",
      distance: { state: "measured", km: 15.6, basis: "coordinates" },
      travel: estimated(20, 20, 15.6),
    },
    {
      // 22 km in a straight line, an hour around the lake: the case that
      // makes any km→minutes factor wrong.
      id: "fintry-provincial-park",
      distance: { state: "measured", km: 22, basis: "coordinates" },
      travel: estimated(61, 50.4, 22),
    },
    {
      // Further in a straight line than Fintry and twenty minutes nearer.
      id: "kangaroo-creek-farm",
      distance: { state: "measured", km: 34.3, basis: "coordinates" },
      travel: estimated(39, 39.5, 34.3),
    },
    {
      id: "kalamalka-lake-park",
      distance: { state: "measured", km: 12.1, basis: "coordinates" },
      travel: {
        ...estimated(82, 33.3, 12.1),
        accessCaution:
          "the route averages 25 km/h over 33.3 km — the point may be inside the site, reached by minor tracks rather than its entrance",
      },
    },
    {
      id: "monashee-backcountry",
      distance: { state: "measured", km: 65.4, basis: "coordinates" },
      travel: {
        state: "unavailable",
        mode: "driving",
        provider: PROVIDER,
        calculatedAt: AT,
        because: "the destination is 3.1 km from the nearest routable road",
      },
    },
  ],
};

/** The same feed asked for walking, where only a driving profile exists. */
export const WALKING_UNSUPPORTED = {
  candidates: [
    {
      id: "davison-orchards",
      travel: {
        state: "unsupported",
        mode: "walking",
        provider: PROVIDER,
        because: `${PROVIDER} is not configured for walking`,
      },
    },
  ],
};

/** Transit: no provider Atlas has evaluated is configured for it (ADR 097). */
export const TRANSIT_UNSUPPORTED = {
  candidates: [
    {
      id: "okanagan-science-centre",
      travel: {
        state: "unsupported",
        mode: "transit",
        provider: PROVIDER,
        because: `${PROVIDER} is not configured for transit`,
      },
    },
  ],
};

/**
 * **Atlas today.** It ignores `travel=`, so the feed answers with distance and
 * no travel at all — the shape of a capability that is not there yet.
 */
export const ATLAS_TODAY = {
  candidates: [
    {
      id: "davison-orchards",
      distance: { state: "measured", km: 2.2, basis: "coordinates" },
    },
    {
      id: "fintry-provincial-park",
      distance: { state: "measured", km: 22, basis: "coordinates" },
    },
  ],
};
