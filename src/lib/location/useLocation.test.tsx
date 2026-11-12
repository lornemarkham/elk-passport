import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { resetPrefsForTest } from "./store";
import { resetFallbackForTest, useLocation } from "./useLocation";

/** Vernon, Kelowna and Vancouver: the three places the brief names. */
const AT = {
  vernon: { latitude: 50.267, longitude: -119.272 },
  vancouver: { latitude: 49.2827, longitude: -123.1207 },
};

let getCurrentPosition: ReturnType<typeof vi.fn>;

function stubBrowser(options: {
  permission?: "granted" | "denied" | "prompt" | "unsupported";
  position?: { latitude: number; longitude: number };
  edge?: { townId: string; source: string } | "offline";
}) {
  getCurrentPosition = vi.fn((ok: PositionCallback) =>
    ok({ coords: options.position ?? AT.vernon } as GeolocationPosition),
  );
  vi.stubGlobal("navigator", {
    geolocation: { getCurrentPosition },
    ...(options.permission !== "unsupported"
      ? {
          permissions: {
            query: async () => ({ state: options.permission ?? "prompt" }),
          },
        }
      : {}),
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      if (options.edge === "offline") throw new Error("offline");
      return {
        ok: true,
        json: async () =>
          options.edge ?? { townId: "kelowna", source: "approximate" },
      };
    }),
  );
}

beforeEach(() => {
  window.localStorage.clear();
  resetPrefsForTest();
  resetFallbackForTest();
});
afterEach(() => vi.unstubAllGlobals());

describe("where Passport opens", () => {
  it("uses the saved exploration place first, and asks nobody", async () => {
    stubBrowser({ permission: "granted" });
    window.localStorage.setItem(
      "ghad.location.v1",
      JSON.stringify({ exploring: "vancouver", recent: [], destinations: {} }),
    );
    resetPrefsForTest();
    const { result } = renderHook(() => useLocation());
    await waitFor(() => expect(result.current.townId).toBe("vancouver"));
    expect(result.current.source).toBe("chosen");
    expect(result.current.approximate).toBe(false);
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("uses a browser position that was already granted, without prompting", async () => {
    stubBrowser({ permission: "granted", position: AT.vancouver });
    const { result } = renderHook(() => useLocation());
    await waitFor(() => expect(result.current.townId).toBe("vancouver"));
    expect(result.current.source).toBe("device");
    // Mapped to a town and not remembered: re-worked every launch.
    expect(window.localStorage.getItem("ghad.location.v1")).toBeNull();
  });

  it.each(["denied", "prompt", "unsupported"] as const)(
    "never asks the browser when permission is %s, and says it is approximate",
    async (permission) => {
      stubBrowser({ permission });
      const { result } = renderHook(() => useLocation());
      await waitFor(() => expect(result.current.townId).toBe("kelowna"));
      expect(getCurrentPosition).not.toHaveBeenCalled();
      expect(result.current.source).toBe("approximate");
      expect(result.current.approximate).toBe(true);
    },
  );

  it("falls back to the launch region, labelled as a default, when nothing is known", async () => {
    stubBrowser({ permission: "denied", edge: "offline" });
    const { result } = renderHook(() => useLocation());
    await waitFor(() => expect(result.current.townId).toBe("vernon"));
    expect(result.current.source).toBe("default");
    expect(result.current.approximate).toBe(true);
  });

  it("a granted position far from anywhere covered falls through to the regional guess", async () => {
    stubBrowser({
      permission: "granted",
      position: { latitude: 51.5, longitude: -0.12 },
    });
    const { result } = renderHook(() => useLocation());
    await waitFor(() => expect(result.current.source).toBe("approximate"));
  });
});

describe("changing it", () => {
  it("Vernon → Kelowna → Vancouver is remembered, shared and recent", async () => {
    stubBrowser({ permission: "denied" });
    const a = renderHook(() => useLocation());
    const b = renderHook(() => useLocation("christmas"));
    await waitFor(() => expect(a.result.current.ready).toBe(true));
    for (const id of ["vernon", "kelowna", "vancouver"]) {
      act(() => a.result.current.choose(id));
      // Another experience on the same page follows at once.
      expect(b.result.current.townId).toBe(id);
      expect(a.result.current.source).toBe("chosen");
      expect(a.result.current.approximate).toBe(false);
    }
    expect(a.result.current.recent.map((t) => t.id)).toEqual([
      "vancouver",
      "kelowna",
      "vernon",
    ]);
    expect(
      JSON.parse(window.localStorage.getItem("ghad.location.v1")!).exploring,
    ).toBe("vancouver");
  });

  it("a destination for one experience leaves home and the others alone", async () => {
    stubBrowser({ permission: "denied" });
    const snow = renderHook(() => useLocation("snow"));
    const xmas = renderHook(() => useLocation("christmas"));
    await waitFor(() => expect(snow.result.current.ready).toBe(true));
    act(() => snow.result.current.choose("vernon"));
    act(() => snow.result.current.makeHome("vernon"));
    act(() => xmas.result.current.choose("kelowna", { onlyHere: true }));
    expect(xmas.result.current.townId).toBe("kelowna");
    expect(xmas.result.current.hasDestination).toBe(true);
    expect(snow.result.current.townId).toBe("vernon");
    expect(snow.result.current.home?.id).toBe("vernon");
    act(() => xmas.result.current.followShared());
    expect(xmas.result.current.townId).toBe("vernon");
  });

  it("Use my location chooses the nearest covered town", async () => {
    stubBrowser({ permission: "prompt", position: AT.vancouver });
    const { result } = renderHook(() => useLocation());
    await waitFor(() => expect(result.current.ready).toBe(true));
    let out: Awaited<ReturnType<typeof result.current.locate>> | undefined;
    await act(async () => {
      out = await result.current.locate();
    });
    expect(out?.ok).toBe(true);
    expect(result.current.townId).toMatch(/vancouver/);
    expect(result.current.approximate).toBe(false);
  });

  it("says why when location is denied or out of coverage, and changes nothing", async () => {
    stubBrowser({ permission: "prompt" });
    const { result } = renderHook(() => useLocation());
    await waitFor(() => expect(result.current.ready).toBe(true));
    const before = result.current.townId;
    getCurrentPosition.mockImplementationOnce(
      (_ok: PositionCallback, fail: PositionErrorCallback) =>
        fail({ code: 1 } as GeolocationPositionError),
    );
    await act(async () => {
      expect(await result.current.locate()).toEqual({
        ok: false,
        why: "denied",
      });
    });
    getCurrentPosition.mockImplementationOnce((ok: PositionCallback) =>
      ok({
        coords: { latitude: 51.5, longitude: -0.12 },
      } as GeolocationPosition),
    );
    await act(async () => {
      expect(await result.current.locate()).toEqual({
        ok: false,
        why: "outside",
      });
    });
    expect(result.current.townId).toBe(before);
  });
});

describe("the server's copy of the shared place", () => {
  const cookie = () =>
    document.cookie
      .split("; ")
      .find((c) => c.startsWith("ghad-place="))
      ?.split("=")[1];

  it("mirrors a chosen place into ghad-place, and not a destination", async () => {
    stubBrowser({});
    const { result } = renderHook(() => useLocation("christmas"));
    act(() => result.current.choose("kelowna"));
    expect(cookie()).toBe("kelowna");
    act(() => result.current.choose("penticton", { onlyHere: true }));
    expect(cookie()).toBe("kelowna");
  });

  it("never writes a guess", async () => {
    document.cookie = "ghad-place=; path=/; max-age=0";
    stubBrowser({ edge: { townId: "vancouver", source: "approximate" } });
    const { result } = renderHook(() => useLocation());
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.townId).toBe("vancouver");
    expect(cookie() ?? "").toBe("");
  });
});
