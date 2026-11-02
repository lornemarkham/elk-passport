import { describe, expect, it } from "vitest";
import type { Environment } from "@/domain/environment/types";
import { dayForecast, sunlightFor, zonedInstant } from "./conditions";
import { LORNE_AND_JESS as night } from "./nights/lorne-and-jess";

describe("Date Night conditions", () => {
  // British Columbia's offset is whatever the tz database says it is (2026c
  // has BC on UTC-7 all year), so these assert the round trip, not an offset.
  const local = (at: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Vancouver",
      hourCycle: "h23",
      dateStyle: "short",
      timeStyle: "short",
    }).format(at);

  it("reads a local wall-clock hour in the night's zone", () => {
    expect(local(zonedInstant("2026-11-02", 9, "America/Vancouver"))).toBe(
      "2026-11-02, 09:00",
    );
    expect(local(zonedInstant("2026-01-15", 18, "America/Vancouver"))).toBe(
      "2026-01-15, 18:00",
    );
  });

  it("computes sunset for the area — arithmetic, always available", () => {
    const light = sunlightFor(night)!;
    expect(light.sunset).toMatch(/^[45]:\d\d pm$/);
    expect(light.sunrise).toMatch(/^[678]:\d\d am$/);
  });

  const hour = (
    iso: string,
    extra: Partial<Environment["hourly"][number]> = {},
  ) => ({
    at: iso,
    sky: "overcast" as const,
    ...extra,
  });
  const env = (hourly: Environment["hourly"]): Environment => ({
    area: {
      id: "a",
      name: "around Vernon",
      latitude: 50.267,
      longitude: -119.272,
    },
    hourly,
    nights: [],
    provenance: {
      source: "Environment Canada",
      stationName: "Vernon",
      issuedAt: "2026-11-01T22:00:00Z",
      fetchedAt: "2026-11-01T22:05:00Z",
    },
  });

  const at = (h: number) =>
    zonedInstant(night.on, h, night.timeZone).toISOString();

  it("summarises only the daytime hours the forecast actually covers", () => {
    const forecast = dayForecast(
      env([
        hour(at(7), { temperatureC: -5 }), // before the day
        hour(at(9), {
          temperatureC: 1,
          precipitationChance: 30,
          description: "Cloudy",
        }),
        hour(at(10), {
          temperatureC: 4,
          precipitationChance: 60,
          description: "Rain",
        }),
        hour(at(11), {
          temperatureC: 5,
          description: "Cloudy",
          windKph: 20,
        }),
      ]),
      night,
    )!;
    expect(forecast).toMatchObject({
      source: "Environment Canada",
      city: "Vernon",
      lowC: 1,
      highC: 5,
      wettestChance: 60,
      windKph: 20,
      words: ["Cloudy", "Rain"],
      covers: "9:00 am – 12:00 pm",
    });
  });

  it("says nothing when the forecast does not reach the day", () => {
    expect(
      dayForecast(env([hour("2026-11-01T20:00:00Z"), hour(at(19))]), night),
    ).toBeUndefined();
    expect(dayForecast(undefined, night)).toBeUndefined();
  });
});
