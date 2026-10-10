import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import type { DiscoveryCandidate } from "@/lib/data/types";

/**
 * **The page composes itself before anybody asks it anything.**
 *
 * Measured on 2026-10-10, generic Discovery rendered 2,248 rows in one list —
 * 615 screens — opening with ten parks and no sense of what day it was, under
 * the heading *Discovery* and the sentence "Search, filter, and save the
 * experiences you want to build your next adventure around."
 *
 * These pin what replaced it: the page says what day it is, offers intents in
 * a person's words rather than Atlas's kinds, leads with what is on today, and
 * stops rendering the corpus. They also pin the two things that must not have
 * changed on the way — saving still removes a card, and a visitor still gets
 * everything.
 */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }),
  usePathname: () => "/discovery",
  useSearchParams: () => new URLSearchParams(),
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
    addedAt: "2026-10-10T00:00:00.000Z",
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

const candidate = (over: Partial<DiscoveryCandidate>): DiscoveryCandidate => ({
  id: "id",
  kind: "Place",
  name: "Somewhere",
  description: "A description long enough to be real.",
  subtype: "park",
  mediaCount: 0,
  containsCount: 0,
  regionIds: [],
  ...over,
});

/** A pool with something in every shape the page composes. */
const pool = [
  candidate({
    id: "tonight",
    kind: "Event",
    name: "A concert tonight",
    subtype: "concert",
    startTime: "2026-10-10T00:00:00.000Z",
    endTime: "2026-10-10T00:00:00.000Z",
    timePrecision: "day",
  }),
  candidate({
    id: "soon",
    kind: "Event",
    name: "A talk next week",
    subtype: "lecture",
    startTime: "2026-10-14T00:00:00.000Z",
    endTime: "2026-10-14T00:00:00.000Z",
    timePrecision: "day",
  }),
  candidate({
    id: "finished",
    kind: "Event",
    name: "A festival in September",
    subtype: "festival",
    startTime: "2026-09-01T00:00:00.000Z",
    endTime: "2026-09-02T00:00:00.000Z",
    timePrecision: "day",
  }),
  candidate({ id: "park", name: "Kalamoir Park", subtype: "park" }),
  candidate({
    id: "winery",
    kind: "Organization",
    name: "A winery",
    subtype: "winery",
  }),
].map(candidateToExperience);

const NOW = "2026-10-10T18:00:00.000Z";

const renderPage = (displayName: string | null = null) =>
  render(
    <DiscoveryListView
      experiences={pool}
      displayName={displayName}
      now={NOW}
      today="Saturday, October 10"
    />,
  );

beforeEach(() => vi.clearAllMocks());

describe("what the page says before anything is asked of it", () => {
  it("says what day it is", () => {
    renderPage();
    expect(screen.getByTestId("discovery-context")).toHaveTextContent(
      "Saturday, October 10",
    );
  });

  it("asks the question the page exists to answer", () => {
    renderPage();
    // Not "Discovery", and not a sentence about searching and filtering.
    expect(
      screen.getByRole("heading", { level: 1, name: /what could you do/i }),
    ).toBeTruthy();
  });

  it("does not open with a row count presented as a product fact", () => {
    renderPage();
    // "2248 to explore" was the page's answer to "what could I do?".
    expect(screen.queryByTestId("result-summary")).toBeNull();
  });
});

describe("intents, in a person's words", () => {
  it("offers what the pool can actually fill", () => {
    renderPage();
    const keys = screen
      .getAllByRole("button", { pressed: false })
      .map((b) => b.getAttribute("data-intent"))
      .filter(Boolean);
    expect(keys).toContain("outside");
    expect(keys).toContain("eat");
    // Nothing in this pool is a museum or a hotel, so neither is offered.
    expect(keys).not.toContain("culture");
    expect(keys).not.toContain("stay");
  });

  it("narrows the whole page to one intent, across kind", () => {
    renderPage();
    fireEvent.click(screen.getByTestId("intent-eat"));
    // A winery is an Organization; a park is a Place. Intent cuts across both.
    expect(screen.getByText("A winery")).toBeTruthy();
    expect(screen.queryByText("Kalamoir Park")).toBeNull();
  });

  it("lets the intent back off again", () => {
    renderPage();
    fireEvent.click(screen.getByTestId("intent-eat"));
    fireEvent.click(screen.getByTestId("intent-eat"));
    // The composed page is back — several sections, not one filtered list.
    expect(screen.getAllByTestId("discovery-section").length).toBeGreaterThan(
      1,
    );
  });
});

describe("composition", () => {
  it("leads with what is on today", () => {
    renderPage();
    const [first] = screen.getAllByTestId("discovery-section");
    expect(first!.dataset.section).toBe("today");
    expect(within(first!).getByText("A concert tonight")).toBeTruthy();
  });

  it("never shows something already over", () => {
    renderPage();
    expect(screen.queryByText("A festival in September")).toBeNull();
  });

  it("groups the timeless things by intent rather than by kind", () => {
    renderPage();
    const sections = screen
      .getAllByTestId("discovery-section")
      .map((s) => s.dataset.section);
    expect(sections).toContain("outside");
    expect(sections).toContain("eat");
  });

  it("renders a bounded number of cards, not the corpus", () => {
    // The whole point. 2,248 rows was the defect.
    renderPage();
    expect(screen.getAllByTestId("possibility").length).toBeLessThanOrEqual(
      pool.length,
    );
  });
});

describe("what must not have changed", () => {
  it("still gives a visitor the whole catalogue with no wall", () => {
    renderPage(null);
    expect(screen.getByText("Kalamoir Park")).toBeTruthy();
    expect(screen.getByText("A winery")).toBeTruthy();
  });

  it("still searches, and a search replaces the composed page with results", async () => {
    renderPage();
    fireEvent.change(screen.getByPlaceholderText(/search/i), {
      target: { value: "Kalamoir" },
    });
    await waitFor(() =>
      expect(screen.queryByTestId("discovery-section")).toBeNull(),
    );
    expect(screen.getByText("Kalamoir Park")).toBeTruthy();
    expect(screen.queryByText("A winery")).toBeNull();
  });

  it("still finds something the composed page never showed", () => {
    // `browsing` searches the whole corpus, not the composed selection —
    // which is the entire reason the two are kept apart.
    renderPage();
    fireEvent.change(screen.getByPlaceholderText(/search/i), {
      target: { value: "September" },
    });
    expect(screen.getByText("A festival in September")).toBeTruthy();
  });
});

describe("controls that cannot work are not offered", () => {
  it("offers only the two modes that exist", () => {
    renderPage();
    expect(screen.getByTestId("mode-discover")).toBeTruthy();
    expect(screen.getByTestId("mode-inspiration")).toBeTruthy();
    // Map and AI were greyed-out peers for months. AI as a tab also
    // contradicts the doctrine outright: AI is not a tab.
    expect(screen.queryByText("Map")).toBeNull();
    expect(screen.queryByText("AI")).toBeNull();
  });

  it("sends October out of its own front door rather than rendering it as a view", () => {
    renderPage();
    expect(screen.getByTestId("october-door")).toHaveAttribute(
      "href",
      "/october",
    );
  });
});

describe("the board before anything is in it", () => {
  it("is a line, not a filing cabinet", () => {
    renderPage();
    expect(screen.getByTestId("board-empty")).toBeTruthy();
  });

  it("says what saving is for", () => {
    renderPage(null);
    expect(screen.getByTestId("board-empty")).toHaveTextContent(
      /keep what you find/i,
    );
  });
});

/**
 * **Saying what you feel like must not drop you into a database.**
 *
 * Measured on the deployed page: choosing *Get outside* replaced eight
 * picture-led cards with twenty-four dense rows, led by "Pine Park · PARK · A
 * park located at 1605 A 39A Ave featuring a playground" — the exact sludge
 * the composed page exists to stop leading with, handed straight back the
 * moment somebody expressed an intent. Search did the same thing.
 */
describe("an intent refines the page rather than replacing the product", () => {
  it("still shows possibility cards, not a list", () => {
    renderPage();
    fireEvent.click(screen.getByTestId("intent-eat"));
    expect(screen.getAllByTestId("possibility").length).toBeGreaterThan(0);
  });

  it("leads with what has a picture when nothing was typed", () => {
    // Without a query there is nothing to rank by, so the pool arrived in
    // Atlas's order and the weakest card led.
    const withPicture = {
      ...pool[4]!,
      heroMedia: { type: "image" as const, src: "w.jpg" },
    };
    render(
      <DiscoveryListView
        experiences={[pool[3]!, withPicture]}
        displayName={null}
        now={NOW}
        today="Saturday, October 10"
      />,
    );
    fireEvent.click(screen.getByTestId("intent-eat"));
    const first = screen.getAllByTestId("possibility")[0]!;
    expect(first.dataset.hasImage).toBe("true");
  });

  it("lets relevance win once something is typed", () => {
    renderPage();
    fireEvent.change(screen.getByPlaceholderText(/search/i), {
      target: { value: "winery" },
    });
    expect(screen.getAllByTestId("possibility")[0]!).toHaveTextContent(
      "A winery",
    );
  });

  it("renders search results as the same cards", () => {
    renderPage();
    fireEvent.change(screen.getByPlaceholderText(/search/i), {
      target: { value: "Kalamoir" },
    });
    expect(screen.getAllByTestId("possibility").length).toBeGreaterThan(0);
  });
});

describe("cards say how long you have, not what the database holds", () => {
  it("counts down rather than printing a stated interval", () => {
    renderPage();
    const today = screen.getAllByTestId("discovery-section")[0]!;
    // "Thu, Oct 1, 2026 – Sun, Oct 25, 2026" is not how a person says it.
    expect(today).not.toHaveTextContent(/\d{4} – /);
    expect(today).toHaveTextContent(
      /Today only|Last day|On until|Ends tomorrow/,
    );
  });
});
