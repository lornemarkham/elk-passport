import { afterEach, describe, expect, it, vi } from "vitest";
import { adsbLol, configuredSource } from "./adsb-client";

const answer = (status: number, body: unknown = { ac: [], now: 0 }) =>
  new Response(status === 204 ? null : JSON.stringify(body), { status });

afterEach(() => vi.useRealTimers());

describe("the ADSB.lol client is polite", () => {
  it("serves many viewers from one request", async () => {
    const fetcher = vi.fn(async () => answer(200));
    const source = adsbLol(fetcher as unknown as typeof fetch);
    await Promise.all([
      source.byCallsign("WJA133"),
      source.byCallsign("wja133"),
      source.byCallsign("WJA133"),
    ]);
    await source.byCallsign("WJA133");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("backs off after a 429, answering from cache meanwhile", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(answer(429))
      .mockResolvedValue(answer(200));
    const source = adsbLol(fetcher as unknown as typeof fetch);
    expect(await source.byHex("c088fb")).toBeNull();
    expect(await source.byHex("adcd6d")).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("returns null — not an empty sky — when a request fails", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("offline");
    });
    const source = adsbLol(fetcher as unknown as typeof fetch);
    expect(await source.byCallsign("WJA133")).toBeNull();
  });

  it("remembers that a callsign has no route record", async () => {
    const fetcher = vi.fn(async () => answer(404, ""));
    const source = adsbLol(fetcher as unknown as typeof fetch);
    expect(await source.route("WJA999")).toBeNull();
    expect(await source.route("WJA999")).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("never sends a malformed callsign anywhere", async () => {
    const fetcher = vi.fn(async () => answer(200));
    const source = adsbLol(fetcher as unknown as typeof fetch);
    expect(await source.route("../../etc")).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("the opt-in adsb.fi fallback", () => {
  const sky = (flight: string) =>
    answer(200, {
      ac: [{ hex: "c0103e", flight, lat: 49, lon: -123 }],
      now: 1,
    });

  it("is off unless asked for: a 429 stays null", async () => {
    const fetcher = vi.fn(async () => answer(429));
    const source = configuredSource({}, fetcher as unknown as typeof fetch);
    expect(await source.byCallsign("ACA121")).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("asks adsb.fi while ADSB.lol is resting, and says nothing it didn't hear", async () => {
    const urls: string[] = [];
    const fetcher = vi.fn(async (url: string) => {
      urls.push(url);
      return url.includes("adsb.lol") ? answer(429) : sky("ACA121");
    });
    const source = configuredSource(
      { ADSB_FALLBACK: "adsbfi" },
      fetcher as unknown as typeof fetch,
    );
    const first = await source.byCallsign("ACA121");
    expect(first?.aircraft).toHaveLength(1);
    expect(urls[0]).toContain("api.adsb.lol");
    expect(urls[1]).toContain("opendata.adsb.fi/api/v2/callsign/ACA121");
    // ADSB.lol is now resting: the next lookup does not touch it.
    await source.byHex("c0103e");
    expect(urls.filter((u) => u.includes("adsb.lol"))).toHaveLength(1);
  });

  it("uses adsb.fi's v3 area path, and returns null when both are silent", async () => {
    const urls: string[] = [];
    const fetcher = vi.fn(async (url: string) => {
      urls.push(url);
      return answer(429);
    });
    const source = configuredSource(
      { ADSB_FALLBACK: "adsbfi" },
      fetcher as unknown as typeof fetch,
    );
    expect(await source.around(49.1967, -123.1815)).toBeNull();
    expect(urls[1]).toBe(
      "https://opendata.adsb.fi/api/v3/lat/49.1967/lon/-123.1815/dist/250",
    );
  });
});
