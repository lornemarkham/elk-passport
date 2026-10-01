import { describe, expect, it } from "vitest";
import { OCTOBER_PLACES } from "@/domain/environment/places";
import fixture from "./__fixtures__/msc-vernon.json";
import { distanceKm } from "./geo";
import { nightsFrom, readMscFeature, skyFrom } from "./msc";

/**
 * **Read against a real response, not an imagined one.**
 *
 * `__fixtures__/msc-vernon.json` is an actual `citypageweather-realtime`
 * document for Vernon, captured from `api.weather.gc.ca` on 2026-10-01. An
 * adapter tested against a hand-written sample proves only that the author
 * and the test agree about a shape neither of them has seen.
 */
const vernon = OCTOBER_PLACES.find((p) => p.id === "vernon")!;
const properties = (
  fixture as unknown as {
    features: { properties: Record<string, unknown> }[];
  }
).features[0]!.properties;

describe("Environment Canada's words, in Passport's", () => {
  it("separates conditions that keyword matching would confuse", () => {
    // "A few clouds" and "Cloudy periods" both contain "cloud" and mean very
    // different things to somebody hoping to see a meteor.
    expect(skyFrom("A few clouds")).toBe("mainly-clear");
    expect(skyFrom("Cloudy periods")).toBe("partly-cloudy");
    expect(skyFrom("Cloudy")).toBe("overcast");
  });

  it("treats anything falling as worse than overcast", () => {
    for (const said of [
      "Rain",
      "A few showers",
      "Light snow",
      "Flurries",
      "Chance of thundershowers",
      "Freezing drizzle",
    ]) {
      expect(skyFrom(said), said).toBe("precipitating");
    }
  });

  it("refuses to classify a phrase nobody has checked", () => {
    expect(skyFrom("Blowing dust")).toBe("unknown");
    expect(skyFrom(undefined)).toBe("unknown");
  });
});

describe("reading the real Vernon document", () => {
  const now = new Date("2026-10-01T00:30:00Z");
  const reading = readMscFeature(vernon, properties, now)!;

  it("produces a full day of hours", () => {
    expect(reading).toBeDefined();
    expect(reading.hourly.length).toBeGreaterThanOrEqual(20);
  });

  it("carries the forecaster's own words alongside the classification", () => {
    const first = reading.hourly[0]!;
    expect(first.description).toBe("Sunny");
    expect(first.sky).toBe("clear");
    expect(first.temperatureC).toBe(15);
    expect(first.precipitationChance).toBe(0);
  });

  it("unwraps the bilingual envelope so nothing downstream sees it", () => {
    const serialised = JSON.stringify(reading.hourly);
    expect(serialised).not.toContain('"en"');
    expect(serialised).not.toContain('"fr"');
  });

  it("keeps provenance, including the attribution the licence requires", () => {
    expect(reading.provenance.source).toBe("Environment Canada");
    expect(reading.provenance.stationName).toBe("Vernon");
    // The document's own refresh time — see "how old is this, really" below.
    expect(reading.provenance.issuedAt).toBe("2026-10-01T00:09:26Z");
    expect(reading.provenance.fetchedAt).toBe(now.toISOString());
  });

  it("says which place it is for, so a borrowed city is never silent", () => {
    expect(reading.area.id).toBe("vernon");
  });

  it("classifies every hour it returns", () => {
    for (const hour of reading.hourly) {
      expect(hour.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(hour.sky).toBeDefined();
    }
  });
});

describe("when the document is not what we expect", () => {
  it("returns nothing rather than an empty forecast", () => {
    expect(readMscFeature(vernon, {}, new Date())).toBeUndefined();
    expect(
      readMscFeature(vernon, { hourlyForecastGroup: {} }, new Date()),
    ).toBeUndefined();
    expect(
      readMscFeature(
        vernon,
        { hourlyForecastGroup: { hourlyForecasts: [] } },
        new Date(),
      ),
    ).toBeUndefined();
  });
});

describe("nights, which are the only thing that reaches a saved date", () => {
  const reading = readMscFeature(
    vernon,
    properties,
    new Date("2026-10-01T00:30:00Z"),
  )!;

  it("reaches several days out, where hourly reaches one", () => {
    // Hourly runs 24 hours. A meteor shower is a week away.
    expect(reading.nights.length).toBeGreaterThanOrEqual(5);
    const span =
      Date.parse(reading.nights[reading.nights.length - 1]!.day) -
      Date.parse(reading.nights[0]!.day);
    expect(span / 86_400_000).toBeGreaterThanOrEqual(4);
  });

  it("dates periods by their order, never by parsing a weekday name", () => {
    const nights = nightsFrom(
      [
        {
          period: { textForecastName: { en: "Tonight" } },
          abbreviatedForecast: { textSummary: { en: "Clear" } },
        },
        {
          period: { textForecastName: { en: "Thursday" } },
          abbreviatedForecast: { textSummary: { en: "Sunny" } },
        },
        {
          period: { textForecastName: { en: "Thursday night" } },
          abbreviatedForecast: { textSummary: { en: "Cloudy" } },
        },
      ],
      "2026-10-07T23:00:00Z",
    );
    // Day periods are skipped; nights are consecutive from the issue date.
    expect(nights.map((n) => n.day)).toEqual(["2026-10-07", "2026-10-08"]);
    expect(nights[0]!.sky).toBe("clear");
    expect(nights[1]!.sky).toBe("overcast");
  });

  it("reads the forecaster's night words into sky and low", () => {
    const night = reading.nights[0]!;
    expect(night.description).toBe("Clear");
    expect(night.sky).toBe("clear");
    expect(night.lowC).toBe(4);
  });

  it("returns nothing for a document with no periods", () => {
    expect(nightsFrom(undefined, "2026-10-01T00:00:00Z")).toEqual([]);
    expect(nightsFrom([], "2026-10-01T00:00:00Z")).toEqual([]);
  });
});

describe("the nearest city, not the first one returned", () => {
  it("measures real distance between Okanagan towns", () => {
    const kelowna = OCTOBER_PLACES.find((p) => p.id === "kelowna")!;
    const km = distanceKm(vernon, kelowna);
    // Vernon to Kelowna is about 45 km as the crow flies.
    expect(km).toBeGreaterThan(35);
    expect(km).toBeLessThan(60);
  });

  it("keeps the station distance, so a borrowed forecast can be named", () => {
    const reading = readMscFeature(vernon, properties, new Date(), 42.4)!;
    expect(reading.provenance.stationKm).toBe(42);
  });
});

describe("how old is this, really", () => {
  it("ages from the document's own refresh, not a product timestamp", () => {
    // The hourly block here is stamped 16:00Z on a document MSC refreshed at
    // 00:09Z. Reading the former makes fresh data look eight hours stale.
    const reading = readMscFeature(vernon, properties, new Date())!;
    expect(reading.provenance.issuedAt).toBe("2026-10-01T00:09:26Z");
  });
});
