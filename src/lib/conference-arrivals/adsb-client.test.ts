import { afterEach, describe, expect, it, vi } from "vitest";
import { adsbLol } from "./adsb-client";

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
