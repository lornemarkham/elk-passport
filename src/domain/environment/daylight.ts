/**
 * **When it gets dark, which October cares about more than the temperature.**
 *
 * "Dark by six" is the single most October fact there is, and it needs no
 * weather provider, no account and no network: sunrise and sunset are
 * arithmetic on a date and a pair of coordinates. This is the standard NOAA
 * solar position calculation, in its short form.
 *
 * **Measured accuracy: within two minutes of the times Environment Canada
 * publishes** for the same place and day — about 1.5 minutes on the case in
 * `daylight.test.ts`. That is the approximation's own error, not a coordinate
 * problem; the test pins it so it cannot quietly get worse. Two minutes is
 * far inside what "dark by six" needs, and the product never prints a time it
 * has not rounded to the minute anyway.
 *
 * Doing it here rather than reading it from a forecast is a deliberate choice.
 * It means darkness works on a page that has never called anything, it keeps
 * working when a provider is down, and it cannot go stale. The forecast can
 * be unavailable and October can still know that the sun goes down at 6:36.
 *
 * It is also checkable: `daylight.test.ts` pins these against the times
 * Environment Canada publishes for the same place and day, which is as close
 * to an authority as this gets.
 */

const DEG = Math.PI / 180;
const DAY_MS = 86_400_000;

/**
 * The sun's centre is 0.833° below the horizon at the published moment of
 * sunrise and sunset — half the sun's disc plus standard refraction. This is
 * the number that makes the result agree with an almanac.
 */
const SUNSET_ZENITH = 90.833;

export interface Daylight {
  readonly sunrise: Date;
  readonly sunset: Date;
  /** Minutes between them. Falls by roughly three a day through October. */
  readonly daylightMinutes: number;
}

/** Days since the J2000.0 epoch for an instant. */
const toJulianDays = (date: Date): number =>
  date.getTime() / DAY_MS - 0.5 + 2440588 - 2451545;

/**
 * Sunrise and sunset for a point and a day.
 *
 * `on` selects the day — any instant within it, read in UTC, which is why the
 * callers in this product hand it a midday anchor rather than a local
 * midnight. Returns `undefined` above the Arctic circle in the weeks where the
 * sun does not rise or set at all; the Okanagan never sees that, and returning
 * nothing is still better than returning a NaN dressed as a time.
 */
export function daylightAt(
  latitude: number,
  longitude: number,
  on: Date,
): Daylight | undefined {
  const n = Math.round(toJulianDays(on) + 0.0009 + longitude / 360);
  const solarNoonApprox = 0.0009 - longitude / 360 + n;

  // Mean anomaly, equation of centre, ecliptic longitude.
  const meanAnomaly = (357.5291 + 0.98560028 * solarNoonApprox) % 360;
  const centre =
    1.9148 * Math.sin(meanAnomaly * DEG) +
    0.02 * Math.sin(2 * meanAnomaly * DEG) +
    0.0003 * Math.sin(3 * meanAnomaly * DEG);
  const eclipticLongitude = (meanAnomaly + centre + 180 + 102.9372) % 360;

  const solarTransit =
    2451545 +
    solarNoonApprox +
    0.0053 * Math.sin(meanAnomaly * DEG) -
    0.0069 * Math.sin(2 * eclipticLongitude * DEG);

  const declination = Math.asin(
    Math.sin(eclipticLongitude * DEG) * Math.sin(23.44 * DEG),
  );

  const cosHourAngle =
    (Math.cos(SUNSET_ZENITH * DEG) -
      Math.sin(latitude * DEG) * Math.sin(declination)) /
    (Math.cos(latitude * DEG) * Math.cos(declination));

  // The sun never reaches the horizon on this day, either way.
  if (cosHourAngle > 1 || cosHourAngle < -1) return undefined;

  const hourAngle = Math.acos(cosHourAngle) / DEG;
  const setJulian = solarTransit + hourAngle / 360;
  const riseJulian = solarTransit - hourAngle / 360;

  const toDate = (julian: number) =>
    new Date((julian - 2440588 + 0.5) * DAY_MS);

  const sunrise = toDate(riseJulian);
  const sunset = toDate(setJulian);
  return {
    sunrise,
    sunset,
    daylightMinutes: Math.round(
      (sunset.getTime() - sunrise.getTime()) / 60_000,
    ),
  };
}

/**
 * **Is it dark out, right now?**
 *
 * The honest, useful version of the question — not "is it night" but "has the
 * sun gone down", because an October evening starts at sunset and a haunt
 * opens when it is dark rather than when it is late.
 */
export function isDarkAt(
  latitude: number,
  longitude: number,
  now: Date,
): boolean | undefined {
  const today = daylightAt(latitude, longitude, now);
  if (!today) return undefined;
  return now < today.sunrise || now >= today.sunset;
}

/**
 * **How much of the moon is lit, 0 to 1**, with 0 a new moon and 1 a full one.
 *
 * Here because of meteors. A full moon washes out everything but the brightest
 * of them, and it is the single piece of sky context that no weather forecast
 * carries and no provider is needed for. The synodic-month approximation below
 * is good to a few hours of the true phase, which is a long way inside the
 * precision of *the moon will not be a problem this year*.
 */
export function moonIllumination(at: Date): number {
  // A known new moon, and the mean synodic month.
  const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);
  const SYNODIC_DAYS = 29.530588853;
  const days = (at.getTime() - KNOWN_NEW_MOON) / DAY_MS;
  const phase = (((days / SYNODIC_DAYS) % 1) + 1) % 1;
  // 0 at new, 1 at full, symmetric either side.
  return (1 - Math.cos(2 * Math.PI * phase)) / 2;
}

/**
 * **How light it is outside, in the three states a page can respond to.**
 *
 * `dusk` is the hour either side of sunset — the part of an October evening
 * that actually feels like October, and the reason this is three states rather
 * than a boolean. Everything else is `day` or `night`.
 */
export type LightPhase = "day" | "dusk" | "night";

const DUSK_MINUTES = 60;

export function lightPhaseAt(
  latitude: number,
  longitude: number,
  now: Date,
): LightPhase | undefined {
  const today = daylightAt(latitude, longitude, now);
  if (!today) return undefined;
  const dusk = DUSK_MINUTES * 60_000;
  const t = now.getTime();
  const sunset = today.sunset.getTime();
  const sunrise = today.sunrise.getTime();
  if (Math.abs(t - sunset) <= dusk || Math.abs(t - sunrise) <= dusk) {
    return "dusk";
  }
  return t > sunrise && t < sunset ? "day" : "night";
}
