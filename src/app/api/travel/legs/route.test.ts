import { afterEach, describe, expect, it, vi } from "vitest";
import { LEGS_DRIVING_MOCK } from "@/lib/routing/fixtures";

const post = async (body: unknown) => {
  const { POST } = await import("./route");
  return POST(
    new Request("http://passport.test/api/travel/legs", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
};

const START = { latitude: 50.267123, longitude: -119.272345 };
const DAVISON = {
  id: "davison-orchards",
  latitude: 50.2853,
  longitude: -119.2958,
};
const OKEEFE = { id: "okeefe-ranch", latitude: 50.3684, longitude: -119.2803 };
const DAY = {
  mode: "driving",
  legs: [
    { from: START, to: DAVISON },
    { from: DAVISON, to: OKEEFE },
    { from: OKEEFE, to: START },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /api/travel/legs", () => {
  it("refuses a question that is not one, without asking Atlas", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    for (const body of [
      null,
      { mode: "driving", legs: [] },
      { mode: "teleport", legs: DAY.legs },
      { mode: "driving", legs: [{ from: START }] },
      {
        mode: "driving",
        legs: [{ from: START, to: { latitude: 95, longitude: 0 } }],
      },
      { mode: "driving", legs: [{ from: START, to: { ...DAVISON, id: 7 } }] },
      { mode: "driving", legs: Array.from({ length: 13 }, () => DAY.legs[0]) },
    ]) {
      expect((await post(body)).status).toBe(400);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rounds the start to ~1 km before Atlas sees it, and answers per leg", async () => {
    const fetchMock = vi.fn(async () => Response.json(LEGS_DRIVING_MOCK));
    vi.stubGlobal("fetch", fetchMock);
    const response = await post(DAY);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=300");

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toMatch(/\/travel\/legs$/);
    expect(init.method).toBe("POST");
    const sent = String(init.body);
    expect(sent).not.toMatch(/50\.267|119\.272/);
    expect(JSON.parse(sent).legs[0].from).toEqual({
      at: { lng: -119.27, lat: 50.27 },
    });

    const body = await response.json();
    expect(body.state).toBe("ready");
    expect(body.journeys[0]).toMatchObject({ kind: "routed", minutes: 9 });
  });

  it("answers not-served, with a 200, while Atlas has no such endpoint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 404 })),
    );
    const response = await post(DAY);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ state: "not-served" });
  });

  it("is a retryable 503 when Atlas fails or cannot be reached", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (const fetchMock of [
      vi.fn(async () => new Response("", { status: 502 })),
      vi.fn(async () => new Response("", { status: 503 })),
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    ]) {
      vi.stubGlobal("fetch", fetchMock);
      const response = await post(DAY);
      expect(response.status).toBe(503);
      expect(response.headers.get("Retry-After")).toBe("30");
    }
  });
});
