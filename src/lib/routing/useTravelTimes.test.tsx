import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useTravelTimes } from "./useTravelTimes";
import { answerFrom } from "./atlasTravel";
import { ATLAS_TODAY, DRIVING_FROM_VERNON, VERNON } from "./fixtures";

const serve = (response: () => Promise<Response>) => {
  const fetchMock = vi.fn(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useTravelTimes", () => {
  it("is idle with nothing to measure from, and asks nobody", () => {
    const fetchMock = serve(async () => Response.json({}));
    const { result } = renderHook(() => useTravelTimes(undefined, "driving"));
    expect(result.current).toEqual({ status: "idle" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is loading, then ready with Atlas's journeys", async () => {
    const fetchMock = serve(async () =>
      Response.json(answerFrom(DRIVING_FROM_VERNON.candidates, "driving")),
    );
    const { result } = renderHook(() => useTravelTimes(VERNON, "driving"));
    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.journeys?.["fintry-provincial-park"]).toMatchObject({
      kind: "routed",
      minutes: 61,
    });
    // The position goes in a body, never a URL.
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("/api/discovery/travel");
    expect(JSON.parse(String(init.body))).toEqual({
      latitude: VERNON.latitude,
      longitude: VERNON.longitude,
      mode: "driving",
    });
  });

  it("is not-served when Atlas has no travel times", async () => {
    serve(async () =>
      Response.json(answerFrom(ATLAS_TODAY.candidates, "driving")),
    );
    const { result } = renderHook(() => useTravelTimes(VERNON, "driving"));
    await waitFor(() => expect(result.current.status).toBe("not-served"));
    expect(result.current.journeys).toBeUndefined();
  });

  it("is failed, not empty, when the route cannot answer", async () => {
    serve(async () => Response.json({ error: "unavailable" }, { status: 503 }));
    const { result } = renderHook(() => useTravelTimes(VERNON, "driving"));
    await waitFor(() => expect(result.current.status).toBe("failed"));
  });

  it("is failed when the network throws", async () => {
    serve(async () => {
      throw new TypeError("fetch failed");
    });
    const { result } = renderHook(() => useTravelTimes(VERNON, "walking"));
    await waitFor(() => expect(result.current.status).toBe("failed"));
  });

  it("does not show an old mode's answer under a new one", async () => {
    let release: (r: Response) => void = () => {};
    serve(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    );
    const { result, rerender } = renderHook(
      ({ mode }: { mode: "driving" | "walking" }) =>
        useTravelTimes(VERNON, mode),
      { initialProps: { mode: "driving" } },
    );
    const driving = release;
    rerender({ mode: "walking" });
    driving(
      Response.json(answerFrom(DRIVING_FROM_VERNON.candidates, "driving")),
    );
    await new Promise((r) => setTimeout(r, 10));
    expect(result.current.status).toBe("loading");
  });
});
