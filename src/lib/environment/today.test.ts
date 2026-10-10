import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/environment/here/route";
import { blunt, LOCATION_PRECISION } from "@/domain/discovery/situation";
import fixture from "./__fixtures__/msc-vernon.json";
import { weatherToday } from "./today";

/**
 * **The bridge from a person's coordinates to an official forecast.**
 *
 * There is no second weather provider here and there is no interpolation. The
 * Environment Canada adapter was already written to search a bounding box for
 * the nearest city it publishes — the twenty-two October towns were only ever
 * the points Passport happened to hand it. So a reader's own position goes in
 * as an ad-hoc point, and what comes back is **Vernon's forecast, labelled
 * Vernon**, even when the reader is twenty kilometres down the valley.
 *
 * That labelling is the entire honesty of the feature, and it is what these
 * pin: the distance is reported, the city is named, the position is blunted
 * before it is sent and blunted again before it is used, and nothing is
 * claimed where no Canadian city is near enough to ask about.
 */

/** Lumby: a real place, 21 km from the nearest city MSC publishes. */
const LUMBY = { latitude: 50.25, longitude: -118.97 };
const AT = new Date("2026-10-01T01:00:00Z");
const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubEnv("WEATHER_PROVIDER", "msc");
  // The fixture is a real document captured on 2026-10-01, and the bridge
  // reads "the rest of today" from it. A test that let the clock run would
  // start passing and failing on the date.
  vi.setSystemTime(AT);
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: async () => fixture });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("a forecast for roughly where somebody is", () => {
  it("names the city the forecast actually belongs to, not the point asked about", async () => {
    const weather = await weatherToday(LUMBY, AT);
    expect(weather?.area).toBe("Vernon");
    expect(weather?.source).toBe("Environment Canada");
  });

  it("says how far away that city is", async () => {
    // 21 km and a ridge. A product that showed this as "your weather" would
    // be wrong often enough to matter, which is why the number is carried.
    expect((await weatherToday(LUMBY, AT))?.km).toBeGreaterThan(15);
  });

  it("searches a box around the point it was given", async () => {
    await weatherToday(LUMBY, AT);
    const url = String(fetchMock.mock.calls[0]![0]);
    const [west, south, east, north] = new URL(url).searchParams
      .get("bbox")!
      .split(",")
      .map(Number);
    expect(west).toBeLessThan(LUMBY.longitude);
    expect(east).toBeGreaterThan(LUMBY.longitude);
    expect(south).toBeLessThan(LUMBY.latitude);
    expect(north!).toBeGreaterThan(LUMBY.latitude);
  });

  it("sends the position to Environment Canada and to nowhere else", async () => {
    await weatherToday(LUMBY, AT);
    for (const [url] of fetchMock.mock.calls) {
      expect(String(url)).toContain("api.weather.gc.ca");
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("says nothing at all where no Canadian city is near enough", async () => {
    // MSC publishes Canadian cities. The honest answer somewhere it does not
    // reach is nothing — not a nearby country's forecast, not a model guess.
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ features: [] }),
    });
    expect(await weatherToday(LUMBY, AT)).toBeUndefined();
  });

  it("says nothing when the provider is not configured", async () => {
    vi.stubEnv("WEATHER_PROVIDER", "");
    expect(await weatherToday(LUMBY, AT)).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says nothing rather than throwing when the service is down", async () => {
    fetchMock.mockRejectedValue(new Error("network"));
    expect(await weatherToday(LUMBY, AT)).toBeUndefined();
  });
});

describe("blunting a position", () => {
  it("keeps about a kilometre of precision and throws the rest away", () => {
    expect(blunt(50.258136, -119.269061)).toEqual({
      latitude: 50.26,
      longitude: -119.27,
    });
    expect(LOCATION_PRECISION).toBe(2);
  });

  it("rounds toward the nearest, in both hemispheres", () => {
    expect(blunt(-33.8679, 151.2093)).toEqual({
      latitude: -33.87,
      longitude: 151.21,
    });
  });

  it("leaves an already-blunt position alone, so it is safe to apply twice", () => {
    const once = blunt(50.258136, -119.269061);
    expect(blunt(once.latitude, once.longitude)).toEqual(once);
  });
});

describe("the route a position travels through", () => {
  const post = (body: unknown) =>
    POST(
      new Request("http://localhost/api/environment/here", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );

  it("answers with a forecast and no coordinates", async () => {
    const response = await post(LUMBY);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.weather.area).toBe("Vernon");
    // Nothing goes back out that could reconstruct where the caller was.
    expect(JSON.stringify(body)).not.toContain("50.2");
    expect(JSON.stringify(body)).not.toContain("latitude");
  });

  it("blunts again rather than trusting the caller to have done it", async () => {
    await post({ latitude: 50.258136, longitude: -119.269061 });
    const bbox = new URL(String(fetchMock.mock.calls[0]![0])).searchParams.get(
      "bbox",
    )!;
    expect(bbox).not.toContain("50.258");
    // Centre of the box is the rounded point: 50.26 ± 0.6.
    const box = bbox.split(",").map(Number);
    for (const [i, edge] of [-119.87, 49.66, -118.67, 50.86].entries()) {
      expect(box[i]!).toBeCloseTo(edge, 6);
    }
  });

  it("refuses anything that is not a pair of coordinates", async () => {
    for (const bad of [
      {},
      { latitude: 50 },
      { latitude: "north", longitude: "west" },
      { latitude: 91, longitude: 0 },
      { latitude: 0, longitude: 181 },
      // `JSON.stringify(NaN)` is `null` and `Number(null)` is `0`: a browser
      // that sent a failed fix must not be answered with the equator.
      { latitude: null, longitude: 0 },
      { latitude: 0, longitude: null },
    ]) {
      const response = await post(bad);
      expect(response.status).toBe(400);
      // And does not quote the input back, which is how bad input gets logged.
      expect(JSON.stringify(await response.json())).not.toContain("91");
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers an empty object rather than an error when there is no forecast", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ features: [] }),
    });
    const response = await post(LUMBY);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({});
  });
});
