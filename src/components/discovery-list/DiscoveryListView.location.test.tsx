import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { distanceKm } from "@/lib/environment/geo";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import { townById } from "@/domain/discovery/towns";
import type { DiscoveryCandidate } from "@/lib/data/types";
import { resetPrefsForTest } from "@/lib/location/store";
import { resetFallbackForTest } from "@/lib/location/useLocation";

/**
 * **Changing the place changes what Atlas is asked — and the answer.**
 *
 * The real shared-location hook, the real bar and picker, and a stand-in for
 * `/api/discovery/distance` that measures from whatever origin it is *sent*.
 * A page that only relabelled itself would send the same origin each time.
 */
let search = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }),
  usePathname: () => "/discovery",
  useSearchParams: () => search,
}));
vi.mock("@/lib/data/boards-repo", () => ({
  listBoards: async () => [],
  getBoard: async () => null,
  listBoardItems: async () => [],
  isSignedOut: () => false,
}));
vi.mock("@/lib/october/october-repo", () => ({
  listOctoberThings: async () => [],
  wantToDo: async () => {},
}));
vi.mock("sonner", () => ({
  toast: Object.assign(() => {}, { error: vi.fn(), success: vi.fn() }),
}));

const { DiscoveryListView } = await import("./DiscoveryListView");

const at = (town: string, name: string, km = 3): DiscoveryCandidate => {
  const t = townById(town)!;
  return {
    id: name.toLowerCase().replace(/\W+/g, "-"),
    kind: "Place",
    name,
    description: "A description long enough to be real.",
    subtype: "park",
    mediaCount: 0,
    containsCount: 0,
    regionIds: [],
    geography: {
      state: "observed",
      locality: t.name,
      area: { id: t.area, name: t.area },
      coordinates: [t.longitude, t.latitude + km / 111],
    },
  };
};

const pool = [
  at("vernon", "Polson Park"),
  at("kelowna", "City Park Kelowna"),
  at("vancouver", "Stanley Park"),
].map(candidateToExperience);

const asked: { latitude: number; longitude: number }[] = [];
beforeEach(() => {
  search = new URLSearchParams();
  asked.length = 0;
  window.localStorage.clear();
  resetPrefsForTest();
  resetFallbackForTest();
  vi.stubGlobal("navigator", { geolocation: undefined });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/location/approximate")
        return {
          ok: true,
          json: async () => ({ townId: "vernon", source: "default" }),
        };
      const body = JSON.parse(String(init?.body)) as {
        latitude: number;
        longitude: number;
        withinKm: number;
      };
      asked.push(body);
      const distances: Record<string, unknown> = {};
      for (const e of pool) {
        const c = e.geography?.coordinates;
        if (!c) continue;
        const km = distanceKm(body, { latitude: c[1], longitude: c[0] });
        distances[e.id] = {
          state: "measured",
          km: Math.round(km),
          within: km <= body.withinKm,
        };
      }
      return {
        ok: true,
        json: async () => ({ withinKm: body.withinKm, distances }),
      };
    }),
  );
});

const renderPage = () =>
  render(
    <DiscoveryListView
      experiences={pool}
      displayName={null}
      now="2026-10-11T18:00:00.000Z"
      today="Sunday, October 11"
    />,
  );

const choose = async (id: string, query: string) => {
  fireEvent.click(screen.getByTestId("location-change"));
  fireEvent.change(screen.getByTestId("location-search"), {
    target: { value: query },
  });
  await act(async () => {
    fireEvent.click(screen.getByTestId(`location-option-${id}`));
  });
};

describe("Discovery opens on the shared place", () => {
  it("first visit: assumes a region, says it is approximate, and measures from it with no choice made", async () => {
    renderPage();
    await waitFor(() => expect(asked.length).toBeGreaterThan(0));
    expect(screen.getByTestId("location-name").textContent).toBe(
      "Around Vernon, BC",
    );
    expect(screen.getByTestId("location-bar").textContent).toMatch(
      /approximate/,
    );
    expect(asked[0]!.latitude).toBeCloseTo(townById("vernon")!.latitude, 1);
  });

  it("returning visitor: opens on the place they chose last time, stated plainly", async () => {
    window.localStorage.setItem(
      "ghad.location.v1",
      JSON.stringify({
        exploring: "kelowna",
        recent: ["kelowna"],
        destinations: {},
      }),
    );
    resetPrefsForTest();
    renderPage();
    await waitFor(() => expect(asked.length).toBeGreaterThan(0));
    expect(screen.getByTestId("location-name").textContent).toBe("Kelowna, BC");
    expect(screen.getByTestId("location-bar").textContent).not.toMatch(
      /approximate/,
    );
    expect(asked[0]!.latitude).toBeCloseTo(townById("kelowna")!.latitude, 1);
  });

  it("Vernon → Kelowna → Vancouver asks Atlas from each, and the nearest result changes", async () => {
    renderPage();
    const nearest = () =>
      screen.getAllByTestId("possibility")[0]!.querySelector("h3")
        ?.textContent ?? "";
    await waitFor(() => expect(asked.length).toBeGreaterThan(0));

    for (const [id, query, park] of [
      ["vernon", "vernon", "Polson Park"],
      ["kelowna", "kelow", "City Park Kelowna"],
      ["vancouver", "vancouver", "Stanley Park"],
    ] as const) {
      await choose(id, query);
      const t = townById(id)!;
      await waitFor(() =>
        expect(asked.at(-1)!.latitude).toBeCloseTo(t.latitude, 1),
      );
      await waitFor(() => expect(nearest()).toContain(park));
      expect(screen.getByTestId("location-name").textContent).toBe(t.name);
      expect(search.get("at")).toBeNull(); // the URL mock is inert; the page keeps its own copy
    }
    expect(
      JSON.parse(window.localStorage.getItem("ghad.location.v1")!).exploring,
    ).toBe("vancouver");
  });
});
