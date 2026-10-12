import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ATLAS_LEGS_DRIVING_MOCK,
  LEGS_DRIVING_MOCK,
  atlasLegsBody,
} from "@/lib/routing/fixtures";
import { forgetTravelLegsAnswers } from "@/lib/routing/atlasLegs.server";
import { legsLimiter } from "@/lib/routing/travelGuard.server";

const signedIn = vi.hoisted(() => ({ id: null as string | null }));
vi.mock("@/lib/auth/currentUser", () => ({
  currentUser: async () =>
    signedIn.id
      ? { id: signedIn.id, email: null, displayName: "Traveller" }
      : null,
}));

const post = async (body: unknown, headers: Record<string, string> = {}) => {
  const { POST } = await import("./route");
  return POST(
    new Request("http://passport.test/api/travel/legs", {
      method: "POST",
      headers,
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
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  forgetTravelLegsAnswers();
  legsLimiter.clear();
  signedIn.id = null;
});

describe("POST /api/travel/legs (Passport's own route; Atlas is asked by GET)", () => {
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
    const fetchMock = vi.fn(async () => Response.json(ATLAS_LEGS_DRIVING_MOCK));
    vi.stubGlobal("fetch", fetchMock);
    const response = await post(DAY);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=300");

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    // Atlas's real route: a GET by Atlas id, with the start rounded.
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
    expect(url).toMatch(
      /\/travel\/legs\?stops=davison-orchards%2Cokeefe-ranch&mode=driving&lat=50\.27&lng=-119\.27$/,
    );
    expect(url).not.toMatch(/50\.267|119\.272/);

    const body = await response.json();
    expect(body.state).toBe("ready");
    expect(body.journeys[0]).toMatchObject({ kind: "routed", minutes: 9 });
    // The way home ends at a town centre: not asked, drawn as a straight line.
    expect(body.journeys[2]).toBeNull();
  });

  it("answers an identical question from memory, without asking Atlas again", async () => {
    const fetchMock = vi.fn(async () => Response.json(ATLAS_LEGS_DRIVING_MOCK));
    vi.stubGlobal("fetch", fetchMock);
    expect((await post(DAY)).status).toBe(200);
    // Same stops, a start in the same ~1 km cell: the same Atlas question.
    const nearby = {
      ...DAY,
      legs: [
        { from: { latitude: 50.2689, longitude: -119.2711 }, to: DAVISON },
        ...DAY.legs.slice(1),
      ],
    };
    expect((await post(nearby)).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((await post({ ...DAY, mode: "walking" })).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps the legs Atlas answered when its provider failed, and keeps none of it", async () => {
    const failed = {
      state: "unavailable",
      mode: "driving",
      provider: "openrouteservice",
      calculatedAt: LEGS_DRIVING_MOCK.legs[0]!.calculatedAt,
      because: "the routing provider did not answer",
      transient: true,
    };
    const fetchMock = vi.fn(async () =>
      Response.json({
        ...atlasLegsBody([LEGS_DRIVING_MOCK.legs[0], failed]),
        failure: "openrouteservice answered 429",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const response = await post(DAY);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = await response.json();
    expect(body).toMatchObject({ state: "ready", temporary: true });
    expect(body.journeys[0]).toMatchObject({ kind: "routed" });
    expect(body.journeys[1]).toMatchObject({
      kind: "unknown",
      because: expect.stringMatching(/could not answer just now/),
    });
    await post(DAY);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("names a stop Atlas no longer holds, and keeps the day", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            error: "Atlas holds no Discovery candidate okeefe-ranch.",
            code: "unknown-stops",
            unknownStops: ["okeefe-ranch"],
          },
          { status: 404 },
        ),
      ),
    );
    const response = await post(DAY);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      state: "ready",
      unknownStops: ["okeefe-ranch"],
    });
    expect(body.journeys[1]).toMatchObject({
      kind: "unknown",
      because: expect.stringMatching(/no longer holds this stop/),
    });
  });

  it("refuses a page on another site, without asking Atlas", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    for (const headers of [
      { origin: "https://elsewhere.example" } as Record<string, string>,
      { "sec-fetch-site": "cross-site" },
    ]) {
      const response = await post(DAY, headers);
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: "cross-site" });
    }
    expect(
      (await post(DAY, { origin: "http://passport.test" })).status,
    ).not.toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("limits one client to 20 a minute, with Retry-After, and counts others apart", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(ATLAS_LEGS_DRIVING_MOCK)),
    );
    const me = { "x-forwarded-for": "203.0.113.7, 10.0.0.1" };
    for (let i = 0; i < 20; i += 1) {
      expect((await post(DAY, me)).status).toBe(200);
    }
    const refused = await post(DAY, me);
    expect(refused.status).toBe(429);
    expect(Number(refused.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(await refused.json()).toMatchObject({ error: "rate-limited" });
    expect(
      (await post(DAY, { "x-forwarded-for": "198.51.100.2" })).status,
    ).toBe(200);
    // Signed in, a person is counted as themselves, not by address.
    signedIn.id = "user-1";
    expect((await post(DAY, me)).status).toBe(200);
  });

  it("asks for no session unless TRAVEL_REQUIRE_SESSION=1", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(ATLAS_LEGS_DRIVING_MOCK)),
    );
    expect((await post(DAY)).status).toBe(200);
    vi.stubEnv("TRAVEL_REQUIRE_SESSION", "1");
    const response = await post(DAY);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "sign-in" });
    signedIn.id = "user-1";
    expect((await post(DAY)).status).toBe(200);
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
      // travel-legs/1: back off at least a minute.
      expect(response.headers.get("Retry-After")).toBe("60");
    }
  });
});
