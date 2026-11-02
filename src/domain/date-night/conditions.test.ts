import { describe, expect, it } from "vitest";
import type { Environment } from "@/domain/environment/types";
import {
  clockTime,
  dayForecast,
  legalOffset,
  sunlightFor,
  zonedInstant,
} from "./conditions";
import { sunsetOf } from "./adventures/compose";
import { TOMORROW } from "./adventures/tomorrow";
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
    expect(light.sunset).toMatch(/^\d:\d\d pm$/);
    expect(light.sunrise).toMatch(/^\d:\d\d am$/);
  });

  // BC stays on UTC−7 from 1 Nov 2026 (the province's announcement; tzdata
  // 2026c). Sunset in Coldstream on Monday 2 Nov is 00:32–00:33 UTC on the
  // 3rd by NOAA's published solar algorithm, worked independently of
  // daylight.ts (M485). On the wall that is 5:33 pm, never 4:33.
  it("puts Monday's sunset at 5:33 pm on the wall", () => {
    expect(sunsetOf(TOMORROW)).toBe(17 * 60 + 33);
    expect(
      clockTime(new Date("2026-11-03T00:33:00Z"), "America/Vancouver"),
    ).toBe("5:33 pm");
  });

  it("keeps BC's legal time when the runtime's tz database is stale", () => {
    // A runtime that predates 2026c still believes in PST (UTC−8).
    const stale = (at: Date) =>
      at.getTime() >= Date.UTC(2026, 10, 1, 9) ? -480 : -420;
    const monday = new Date("2026-11-03T00:33:00Z");
    expect(legalOffset(monday, "America/Vancouver", stale)).toBe(-420);
    // Before the change, the runtime is asked and believed.
    expect(
      legalOffset(new Date("2026-10-15T12:00:00Z"), "America/Vancouver", stale),
    ).toBe(-420);
    // Other zones are the runtime's business.
    expect(legalOffset(monday, "America/Toronto", () => -300)).toBe(-300);
    expect(
      zonedInstant("2026-11-02", 17, "America/Vancouver").toISOString(),
    ).toBe("2026-11-03T00:00:00.000Z");
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
