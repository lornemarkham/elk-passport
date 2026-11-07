import "server-only";
import { parseConditions, type Conditions } from "@/domain/snow/conditions";
import { mountainById } from "@/domain/snow/mountains";

const ENDPOINT = "https://api.open-meteo.com/v1/forecast";

/**
 * **One outside call: a weather-model forecast for a known ski area.**
 *
 * The caller names a mountain by Passport's own id; the coordinates come from
 * `domain/snow/mountains.ts`, never from the request, so nothing about a
 * person's position is involved. The answer is cached for 15 minutes by the
 * platform fetch cache (the model itself updates about hourly). Any failure —
 * network, timeout, a non-200, a body that does not validate — is `null`,
 * and the screen says it could not reach it. It is never filled in.
 */
export async function conditionsFor(
  mountainId: string,
  doFetch: typeof fetch = fetch,
  now: () => Date = () => new Date(),
): Promise<Conditions | null> {
  const m = mountainById(mountainId);
  if (!m) return null;
  const url = new URL(ENDPOINT);
  url.searchParams.set("latitude", String(m.latitude));
  url.searchParams.set("longitude", String(m.longitude));
  url.searchParams.set(
    "current",
    "temperature_2m,apparent_temperature,wind_speed_10m,wind_gusts_10m,weather_code,snowfall",
  );
  url.searchParams.set(
    "daily",
    "weather_code,snowfall_sum,temperature_2m_min,temperature_2m_max,wind_gusts_10m_max,precipitation_probability_max,sunrise,sunset",
  );
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "10");
  try {
    const res = await doFetch(url, {
      signal: AbortSignal.timeout(6000),
      next: { revalidate: 900 },
    } as RequestInit);
    if (!res.ok) return null;
    return parseConditions(await res.json(), now().toISOString());
  } catch {
    return null;
  }
}
