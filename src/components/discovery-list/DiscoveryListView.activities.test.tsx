import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import type { DiscoveryCandidate } from "@/lib/data/types";

/**
 * **Every activity, findable** (owner's brief, 2026-10-16).
 *
 * Production Discovery offered four activities for the whole of Vernon:
 * *Hiking 53 · Swimming 31 · Fishing 25 · Playground 16*. These pin what
 * replaced the cut: one way into every activity, rare and out-of-season ones
 * included, each saying whether Atlas holds anything for it here — and a
 * pick that is said to the same reader as a typed sentence.
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
  saveExperienceToBoard: async () => ({}),
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

const place = (
  name: string,
  over: Partial<DiscoveryCandidate> = {},
): DiscoveryCandidate => ({
  id: name.toLowerCase().replace(/\W+/g, "-"),
  kind: "Place",
  name,
  description: "A description long enough to be real, about this place.",
  subtype: "park",
  mediaCount: 0,
  containsCount: 0,
  regionIds: [],
  geography: {
    state: "observed",
    locality: "Vernon",
    area: { id: "okanagan", name: "Okanagan" },
  },
  ...over,
});
const doing = (...names: string[]) => ({
  knowledge: {
    affordances: names.map((name) => ({
      name,
      basis: "offers" as const,
    })),
  },
});

// Names and Atlas words from the production corpus on 2026-10-16.
const pool = [
  place("Allan Brooks Nature Centre", {
    subtype: "nature centre",
    ...doing("Birdwatching", "Spot songbirds"),
  }),
  place("Silver Star Mountain Resort", { subtype: "ski resort" }),
  place("Kalamalka Lake Park", doing("Hiking", "Swimming", "Canoeing")),
  place("Polson Park", doing("Hiking", "Playground")),
  place("Museum of Vernon", { subtype: "museum" }),
].map(candidateToExperience);

const fakeServer = vi.fn(
  async () => new Response(JSON.stringify({ by: "words", ask: {} })),
);

const renderPage = () => {
  const page = () => (
    <DiscoveryListView
      experiences={pool}
      displayName={null}
      now="2026-10-16T18:00:00.000Z"
      today="Friday, October 16"
    />
  );
  const view = render(page());
  rerenders.push(() => view.rerender(page()));
  return view;
};

const said = () => new URLSearchParams(window.location.search).getAll("ask");
const explorer = () => screen.getByTestId("activity-explorer");
const chip = (key: string) =>
  within(explorer())
    .getAllByTestId("activity-chip")
    .find((c) => c.dataset.activity === key);
const open = () =>
  act(async () => {
    fireEvent.click(screen.getAllByTestId("activity-explorer-open")[0]!);
  });

beforeEach(() => {
  vi.clearAllMocks();
  search = new URLSearchParams();
  rerenders.length = 0;
  window.history.replaceState(null, "", "/discovery");
  vi.stubGlobal("fetch", fakeServer);
});

describe("the activity explorer", () => {
  it("is one button on the front door, not a wall of chips", () => {
    renderPage();
    expect(screen.queryByTestId("activity-explorer")).toBeNull();
    expect(
      within(screen.getByTestId("ask-discovery")).getByTestId(
        "activity-explorer-open",
      ),
    ).toHaveTextContent("All activities");
  });

  it("lists rare and out-of-season activities on their shelves", async () => {
    renderPage();
    await open();
    const shelves = within(explorer())
      .getAllByTestId("activity-shelf")
      .map((s) => s.getAttribute("aria-label"));
    expect(shelves).toEqual([
      "Outdoors",
      "Adventure",
      "Water",
      "Winter",
      "Arts & Culture",
      "Entertainment",
      "Family",
      "Food & Drink",
      "Relaxation",
    ]);
    // One place is enough to be listed.
    expect(chip("birdwatching")).toHaveTextContent("Birdwatching1");
    // Skiing in October is listed, saying when it usually is.
    expect(chip("skiing")).toHaveTextContent("Dec–Mar");
    // The narrow way of paddling Atlas listed, beside the broad one.
    expect(chip("canoeing")).toBeDefined();
    expect(chip("paddling")).toBeDefined();
  });

  it("says what Atlas holds nothing for, without making it a button", async () => {
    renderPage();
    await open();
    expect(chip("bowling")).toBeUndefined();
    expect(
      within(explorer())
        .getAllByTestId("activity-none-yet")
        .map((p) => p.textContent)
        .join(" "),
    ).toMatch(/bowling/);
  });

  it("finds an activity by a person's word", async () => {
    renderPage();
    await open();
    fireEvent.change(screen.getByTestId("activity-explorer-filter"), {
      target: { value: "birds" },
    });
    expect(
      within(explorer())
        .getAllByTestId("activity-chip")
        .map((c) => c.dataset.activity),
    ).toEqual(["birdwatching"]);
  });

  it("says a pick, so the answer is the conversation's", async () => {
    renderPage();
    await open();
    await act(async () => {
      fireEvent.click(chip("birdwatching")!);
    });
    expect(said()).toEqual(["Birdwatching"]);
    expect(screen.queryByTestId("activity-explorer")).toBeNull();
    expect(screen.getByTestId("ask-heading")).toHaveTextContent("Birdwatching");
    expect(screen.getByTestId("ask-answer")).toHaveTextContent(
      "Allan Brooks Nature Centre",
    );
  });

  it("answers skiing in October with the ski hill, and the calendar", async () => {
    renderPage();
    await open();
    await act(async () => {
      fireEvent.click(chip("skiing")!);
    });
    const answer = screen.getByTestId("ask-answer");
    expect(answer).toHaveTextContent("Silver Star Mountain Resort");
    expect(answer).toHaveTextContent(/usually runs December to March/);
  });
});
