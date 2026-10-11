import { afterEach, describe, expect, it, vi } from "vitest";
import { ATLAS_TODAY, DRIVING_FROM_VERNON } from "@/lib/routing/fixtures";

const post = async (body: unknown) => {
  const { POST } = await import("./route");
  return POST(
    new Request("http://passport.test/api/discovery/travel", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /api/discovery/travel", () => {
  it("refuses a bad origin or an unknown mode without asking Atlas", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    for (const body of [
      null,
      { latitude: 50.27, longitude: -119.27 },
      { latitude: 50.27, longitude: -119.27, mode: "teleport" },
      { latitude: 95, longitude: -119.27, mode: "driving" },
      { latitude: "50.27", longitude: -119.27, mode: "driving" },
    ]) {
      expect((await post(body)).status).toBe(400);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("blunts the origin and returns Atlas's journeys", async () => {
    const fetchMock = vi.fn(async () => Response.json(DRIVING_FROM_VERNON));
    vi.stubGlobal("fetch", fetchMock);
    const response = await post({
      latitude: 50.26712,
      longitude: -119.27234,
      mode: "driving",
    });
    expect(response.status).toBe(200);
    const url = String((fetchMock.mock.calls[0] as unknown[])[0]);
    expect(url).toMatch(
      /lat=50\.27&lng=-119\.27&unplaced=drop&travel=driving$/,
    );
    expect(url).not.toMatch(/50\.267/);
    const body = await response.json();
    expect(body.journeys["fintry-provincial-park"].minutes).toBe(61);
  });

  it("answers not-served with a 200 while Atlas has no travel times", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(ATLAS_TODAY)),
    );
    const response = await post({
      latitude: 50.27,
      longitude: -119.27,
      mode: "driving",
    });
    expect(response.status).toBe(200);
    expect((await response.json()).state).toBe("not-served");
  });

  it("answers 503 when Atlas cannot be reached, and logs no coordinate", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await post({
      latitude: 50.27,
      longitude: -119.27,
      mode: "walking",
    });
    expect(response.status).toBe(503);
    expect(log.mock.calls.flat().join(" ")).not.toMatch(/50\.27|119/);
  });
});
