import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import type { DiscoveryCandidate } from "@/lib/data/types";
import { placeById } from "@/domain/environment/places";

/**
 * **"How far will you go?" did nothing at all, for everybody.**
 *
 * Reported from production: the three distance controls were disabled and
 * *"share where you are"* did not work. Two causes, both real:
 *
 * 1. the only way to produce an origin was a browser permission, and `useHere`
 *    withheld the offer the instant it was pressed — so a denial, a timed-out
 *    fix or an unreachable Environment Canada left three dead pills behind the
 *    words *"Share where you are first"* with nothing left to press;
 * 2. the pills read "15 min", "30 min" and "an hour's drive" while filtering
 *    on `km <= within`, so even working they would have been claiming a drive
 *    time Passport has no routing service to calculate.
 *
 * These pin the fix end to end: a town produces an origin with no permission
 * involved, and each tier genuinely returns more than the last.
 */
let search = new URLSearchParams();
const rerenders: (() => void)[] = [];
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: () => {},
    push: () => {},
    replace: (url: string) => {
      search = new URLSearchParams(url.startsWith("?") ? url.slice(1) : "");
      for (const r of rerenders) r();
    },
  }),
  usePathname: () => "/discovery",
  useSearchParams: () => search,
}));

vi.mock("@/lib/data/boards-repo", () => ({
  listBoards: async () => [],
  getBoard: async () => null,
  listBoardItems: async () => [],
  createBoard: async (name: string) => ({ id: "b", name }),
  saveExperienceToBoard: async () => ({
    id: "i",
    boardId: "b",
    experienceId: "x",
    addedAt: "2026-10-11T00:00:00.000Z",
  }),
  removeExperienceFromBoard: async () => {},
  renameBoard: async () => {},
  deleteBoard: async () => {},
  isSignedOut: () => false,
}));
vi.mock("@/lib/october/october-repo", () => ({
  listOctoberThings: async () => [],
  wantToDo: async () => {},
}));
vi.mock("sonner", () => {
  const toast = () => {};
  toast.error = vi.fn();
  toast.success = vi.fn();
  return { toast };
});

const { DiscoveryListView } = await import("./DiscoveryListView");

const VERNON = placeById("vernon")!;

/**
 * A park at a real bearing and distance from Vernon's own centroid.
 *
 * Built from the coordinate rather than asserted about: a test that hardcodes
 * "this one is 40 km away" is a test that believes its own arithmetic instead
 * of `distanceTo`'s. One degree of latitude is ~111 km everywhere.
 */
const northOfVernon = (name: string, km: number): DiscoveryCandidate => ({
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
    locality: "Vernon",
    area: { id: "okanagan", name: "Okanagan" },
    coordinates: [VERNON.longitude, VERNON.latitude + km / 111],
  },
});

/** Atlas states no coordinate for this, which is true of 68% of the corpus. */
const unplaced = (name: string): DiscoveryCandidate => ({
  id: name.toLowerCase().replace(/\W+/g, "-"),
  kind: "Place",
  name,
  description: "A description long enough to be real.",
  subtype: "park",
  mediaCount: 0,
  containsCount: 0,
  regionIds: [],
  geography: { state: "observed", area: { id: "okanagan", name: "Okanagan" } },
});

const pool = [
  northOfVernon("Polson Park", 5),
  northOfVernon("Ellison Park", 12),
  northOfVernon("Kalamalka Lake Park", 22),
  northOfVernon("Silver Star", 45),
  northOfVernon("Revelstoke Mountain", 150),
  unplaced("Jump2it Indoor Playground"),
].map(candidateToExperience);

const renderPage = () => {
  const view = render(
    <DiscoveryListView
      experiences={pool}
      displayName={null}
      now="2026-10-11T18:00:00.000Z"
      today="Sunday, October 11"
    />,
  );
  rerenders.push(() =>
    view.rerender(
      <DiscoveryListView
        experiences={pool}
        displayName={null}
        now="2026-10-11T18:00:00.000Z"
        today="Sunday, October 11"
      />,
    ),
  );
  return view;
};

/** Every possibility currently on the page, by name. */
const shown = (): string[] =>
  screen
    .getAllByTestId("possibility")
    .map((c) => c.querySelector("h3")?.textContent ?? c.textContent ?? "");

const has = (name: string) => shown().some((t) => t.includes(name));

beforeEach(() => {
  vi.clearAllMocks();
  search = new URLSearchParams();
  rerenders.length = 0;
});

describe("picking a town, with no permission involved", () => {
  it("enables the distance controls", () => {
    renderPage();
    const pills = () =>
      screen
        .getAllByTestId("ghad-choice")
        .filter((b) => b.dataset.row === "distance");
    for (const pill of pills()) expect(pill).toBeDisabled();

    fireEvent.change(screen.getByTestId("ghad-town"), {
      target: { value: "vernon" },
    });
    for (const pill of pills()) expect(pill).toBeEnabled();
  });

  it("writes the town into the URL, so a refresh keeps it", () => {
    renderPage();
    fireEvent.change(screen.getByTestId("ghad-town"), {
      target: { value: "vernon" },
    });
    // Mirrored with `history.replaceState`, not a router navigation: the town
    // changes nothing the server was asked, so re-asking Atlas for the corpus
    // would be a six-second round trip to render the same rows.
    const url = window.location.search;
    expect(new URLSearchParams(url).get("at")).toBe("vernon");
    // A town id, never a coordinate — see `DiscoverySession.at`.
    expect(url).not.toMatch(/\d+\.\d+/);
  });
});

describe("each tier genuinely returns more than the last", () => {
  const pick = (km: string) => {
    fireEvent.click(
      screen
        .getAllByTestId("ghad-choice")
        .find(
          (b) => b.dataset.row === "distance" && b.textContent?.includes(km),
        )!,
    );
  };

  it("15 km is local to Vernon", () => {
    search = new URLSearchParams("at=vernon");
    renderPage();
    pick("15 km");
    expect(has("Polson Park")).toBe(true);
    expect(has("Ellison Park")).toBe(true);
    expect(has("Kalamalka Lake Park")).toBe(false);
    expect(has("Silver Star")).toBe(false);
    expect(has("Revelstoke Mountain")).toBe(false);
  });

  it("30 km reaches further", () => {
    search = new URLSearchParams("at=vernon");
    renderPage();
    pick("30 km");
    expect(has("Kalamalka Lake Park")).toBe(true);
    expect(has("Silver Star")).toBe(false);
  });

  it("60 km further still", () => {
    search = new URLSearchParams("at=vernon");
    renderPage();
    pick("60 km");
    expect(has("Silver Star")).toBe(true);
    // 150 km is outside every tier offered.
    expect(has("Revelstoke Mountain")).toBe(false);
  });

  it("never rules out what Atlas has not placed", () => {
    // The rule the whole feature turns on: 68% of the corpus carries no
    // coordinate, and an unmeasurable distance is not a long one.
    search = new URLSearchParams("at=vernon");
    renderPage();
    pick("15 km");
    expect(has("Jump2it Indoor Playground")).toBe(true);
  });

  it("gives everything back when the distance is let go", () => {
    search = new URLSearchParams("at=vernon");
    renderPage();
    pick("15 km");
    expect(has("Revelstoke Mountain")).toBe(false);
    pick("15 km");
    expect(has("Revelstoke Mountain")).toBe(true);
  });
});
