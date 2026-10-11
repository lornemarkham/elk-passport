import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useTravelLegs } from "./useTravelLegs";
import { legsAnswerFrom } from "./atlasLegs";
import { chainLegs } from "./legs";
import { DAVISON, LEGS_DRIVING_MOCK, OKEEFE } from "./fixtures";

const PERSON = {
  name: "you",
  at: { latitude: 50.267123, longitude: -119.272345 },
};
const LEGS = chainLegs(PERSON, [DAVISON, OKEEFE], { returnHome: true });
const READY = legsAnswerFrom(LEGS_DRIVING_MOCK, 3, "driving");

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useTravelLegs", () => {
  it("is idle, and asks nobody, when no leg is placed", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const unplaced = chainLegs(undefined, [
      { id: "a", name: "A" },
      { id: "b", name: "B" },
    ]);
    const { result } = renderHook(() => useTravelLegs(unplaced, "driving"));
    expect(result.current.status).toBe("idle");
    expect(result.current.journeys).toEqual([undefined]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks only about placed legs and lines the answers up with every leg", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json(
        legsAnswerFrom(
          { legs: LEGS_DRIVING_MOCK.legs.slice(0, 1) },
          1,
          "driving",
        ),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const legs = chainLegs(PERSON, [DAVISON, { id: "x", name: "Unplaced" }]);
    const { result } = renderHook(() => useTravelLegs(legs, "driving"));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.journeys[0]).toMatchObject({ minutes: 9 });
    expect(result.current.journeys[1]).toBeUndefined();
    const sent = JSON.parse(
      String(
        (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body,
      ),
    );
    expect(sent.legs).toHaveLength(1);
  });

  it("rounds the start in the browser and sends no names", async () => {
    const fetchMock = vi.fn(async () => Response.json(READY));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useTravelLegs(LEGS, "driving"));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("/api/travel/legs");
    expect(String(init.body)).not.toMatch(/50\.267|119\.272|you|Davison/);
  });

  it("is not-served when Atlas has no legs endpoint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ state: "not-served", mode: "driving", because: "x" }),
      ),
    );
    const { result } = renderHook(() => useTravelLegs(LEGS, "driving"));
    await waitFor(() => expect(result.current.status).toBe("not-served"));
    expect(result.current.journeys).toEqual([undefined, undefined, undefined]);
  });

  it("fails, and asks again only when told to", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(Response.json(READY));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useTravelLegs(LEGS, "driving"));
    await waitFor(() => expect(result.current.status).toBe("failed"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not ask again for a rebuilt array of the same legs", async () => {
    const fetchMock = vi.fn(async () => Response.json(READY));
    vi.stubGlobal("fetch", fetchMock);
    const { result, rerender } = renderHook(
      ({ legs }) => useTravelLegs(legs, "driving"),
      { initialProps: { legs: LEGS } },
    );
    await waitFor(() => expect(result.current.status).toBe("ready"));
    rerender({ legs: [...LEGS] });
    expect(result.current.status).toBe("ready");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
