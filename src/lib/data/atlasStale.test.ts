import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/**
 * **A warm instance outlives a bad hour at Atlas; a cold one does not pretend.**
 *
 * The cache serves a stale corpus while it refreshes (`USABLE_MS`), and now
 * also when the refresh *fails* — for six hours. These pin both edges: the
 * stale answer is used, and past the bound, or with nothing held, the failure
 * is the failure it always was.
 */
const HOUR = 60 * 60_000;
const corpus = [{ id: "a", kind: "Place", name: "Kal Beach" }];

let atlasUp = true;
let reads = 0;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-15T12:00:00Z"));
  process.env.ATLAS_SERVICE_TOKEN = "stale-test-token";
  atlasUp = true;
  reads = 0;
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubGlobal("fetch", () => {
    reads += 1;
    return atlasUp
      ? Promise.resolve(
          new Response(JSON.stringify({ candidates: corpus }), {
            status: 200,
          }),
        )
      : Promise.reject(new Error("fetch failed"));
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("when Atlas stops answering", () => {
  it("serves the corpus this instance already holds, past the hour it is normally usable", async () => {
    const { listDiscoveryCandidates } = await import("./atlas-repo");
    expect(await listDiscoveryCandidates()).toEqual(corpus);

    vi.setSystemTime(Date.now() + 2 * HOUR);
    atlasUp = false;
    expect(await listDiscoveryCandidates()).toEqual(corpus);
    expect(reads).toBe(2);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringMatching(/120-minute-old .* Atlas did not answer/),
    );
  });

  it("stops serving it after six hours: that is an outage, and says so", async () => {
    const { listDiscoveryCandidates } = await import("./atlas-repo");
    await listDiscoveryCandidates();

    vi.setSystemTime(Date.now() + 7 * HOUR);
    atlasUp = false;
    await expect(listDiscoveryCandidates()).rejects.toMatchObject({
      reason: "unreachable",
    });
  });

  it("never invents a corpus on an instance that holds none", async () => {
    atlasUp = false;
    const { listDiscoveryCandidates } = await import("./atlas-repo");
    await expect(listDiscoveryCandidates()).rejects.toMatchObject({
      reason: "unreachable",
    });
  });

  it("prefers a real answer the moment there is one", async () => {
    const { listDiscoveryCandidates } = await import("./atlas-repo");
    await listDiscoveryCandidates();
    vi.setSystemTime(Date.now() + 2 * HOUR);
    corpus.push({ id: "b", kind: "Place", name: "Polson Park" });
    expect(await listDiscoveryCandidates()).toHaveLength(2);
    corpus.pop();
  });
});

describe("the regions Atlas holds", () => {
  const regions = { regions: [{ id: "r1", name: "Okanagan", extra: "x" }] };
  let regionReads = 0;
  beforeEach(() => {
    process.env.ADMIN_TOKEN = "admin-test";
    regionReads = 0;
    vi.stubGlobal("fetch", () => {
      regionReads += 1;
      return atlasUp
        ? Promise.resolve(new Response(JSON.stringify(regions)))
        : Promise.resolve(new Response("{}", { status: 500 }));
    });
  });
  afterEach(() => {
    delete process.env.ADMIN_TOKEN;
  });

  it("asks Atlas once for a page view's worth of Discovery, not once each", async () => {
    const { listRegions } = await import("./atlas-repo");
    const first = await listRegions();
    await listRegions();
    await listRegions();
    expect(first).toEqual([{ id: "r1", name: "Okanagan" }]);
    expect(regionReads).toBe(1);
  });

  it("does not remember a failure as 'no regions'", async () => {
    atlasUp = false;
    const { listRegions } = await import("./atlas-repo");
    expect(await listRegions()).toEqual([]);
    atlasUp = true;
    expect(await listRegions()).toEqual([{ id: "r1", name: "Okanagan" }]);
  });

  it("keeps the scope it knew when Atlas stops answering, rather than silently widening to everything", async () => {
    const { listRegions } = await import("./atlas-repo");
    await listRegions();
    vi.setSystemTime(Date.now() + 2 * HOUR);
    atlasUp = false;
    expect(await listRegions()).toEqual([{ id: "r1", name: "Okanagan" }]);
  });

  it("is empty without the admin token, without asking", async () => {
    delete process.env.ADMIN_TOKEN;
    const { listRegions } = await import("./atlas-repo");
    expect(await listRegions()).toEqual([]);
    expect(regionReads).toBe(0);
  });
});
