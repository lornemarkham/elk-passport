import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import type { DiscoveryCandidate } from "@/lib/data/types";

/**
 * **Saving a Place removes its card, and its card is the only link to its
 * detail page.**
 *
 * Diagnosed after a report that Place detail pages had stopped working. They
 * had not: `/places/{id}` resolved for every Place checked, and the rows that
 * were on screen carried correct links. The four candidates missing from the
 * rendered list were exactly the four saved to the active board — including
 * `Ellison Provincial Park`, saved 2026-08-11 — and the board sidebar renders
 * saved items as plain text with no href. So a saved detail-ready Place has no
 * route to its own page from anywhere on Discover.
 *
 * Removing the card is deliberate (the list is "what's still available to
 * discover") and is kept. Losing the only link was not intended, and the
 * sidebar now carries the same `destinationFor` destination the card would
 * have — so a saved item stays reachable without the card coming back.
 */
const boards = [
  {
    id: "board-1",
    name: "third board 2",
    createdAt: "2026-08-09T00:00:00.000Z",
  },
];
let items: {
  id: string;
  boardId: string;
  experienceId: string;
  addedAt: string;
}[] = [];

vi.mock("@/lib/data/boards-repo", () => ({
  listBoards: async () => boards,
  getBoard: async () => boards[0],
  listBoardItems: async () => items,
  createBoard: async () => boards[0],
  saveExperienceToBoard: async () => items[0],
  removeExperienceFromBoard: async () => {},
  renameBoard: async () => boards[0],
  deleteBoard: async () => {},
}));
vi.mock("@/lib/data/activeBoardStorage", () => ({
  getStoredActiveBoardId: () => "board-1",
  setStoredActiveBoardId: () => {},
  clearStoredActiveBoardId: () => {},
}));

const { DiscoveryListView } = await import("./DiscoveryListView");

const candidate = (over: Partial<DiscoveryCandidate>): DiscoveryCandidate => ({
  id: "id-1",
  kind: "Place",
  name: "Somewhere",
  description: "A description long enough to be real.",
  mediaCount: 0,
  containsCount: 0,
  regionIds: [],
  ...over,
});

const ELLISON = candidate({
  id: "eddd9851-b490-45ad-bb20-cb21e7d9e27f",
  name: "Ellison Provincial Park",
  subtype: "provincial park",
  heroUrl: "https://example.com/ellison.jpg",
  coordinates: [-119.43333333, 50.17361111],
});
const BIG_WHITE = candidate({
  id: "238661eb-e191-4d60-ae3d-748b4543964c",
  name: "Big White Ski Resort",
  subtype: "ski resort",
  heroUrl: "https://example.com/gem-lake.jpg",
  coordinates: [-118.9459084, 49.7379086],
});

const experiences = [ELLISON, BIG_WHITE].map(candidateToExperience);

beforeEach(() => {
  items = [];
});

describe("a saved Place and its detail-page link", () => {
  it("links both Places while neither is saved", async () => {
    render(<DiscoveryListView experiences={experiences} />);
    await waitFor(() =>
      expect(
        screen.getByRole("link", { name: "Ellison Provincial Park" }),
      ).toHaveAttribute("href", "/places/eddd9851-b490-45ad-bb20-cb21e7d9e27f"),
    );
    expect(
      screen.getByRole("link", { name: "Big White Ski Resort" }),
    ).toHaveAttribute("href", "/places/238661eb-e191-4d60-ae3d-748b4543964c");
  });

  it("removes a saved Place from the list and keeps it reachable from the board", async () => {
    items = [
      {
        id: "item-1",
        boardId: "board-1",
        experienceId: "eddd9851-b490-45ad-bb20-cb21e7d9e27f",
        addedAt: "2026-08-11T13:31:43.515Z",
      },
    ];
    render(<DiscoveryListView experiences={experiences} />);

    // Its card is gone from the list…
    const sidebar = await screen.findByRole("complementary");
    await waitFor(() =>
      expect(within(sidebar).getByText("Ellison Provincial Park")).toBeTruthy(),
    );
    expect(
      screen
        .getAllByRole("listitem")
        .every(
          (li) =>
            li.getAttribute("data-navigates") === null ||
            !li.textContent?.includes("Ellison Provincial Park"),
        ),
    ).toBe(true);

    // …and the board carries the same destination the card would have.
    expect(
      within(sidebar).getByRole("link", { name: "Ellison Provincial Park" }),
    ).toHaveAttribute("href", "/places/eddd9851-b490-45ad-bb20-cb21e7d9e27f");
    // Exactly one link to it — the board's, not a lingering card.
    expect(
      document.querySelectorAll(
        'a[href="/places/eddd9851-b490-45ad-bb20-cb21e7d9e27f"]',
      ),
    ).toHaveLength(1);

    // The unsaved Place is unaffected — saving one thing hides one thing.
    expect(
      screen.getByRole("link", { name: "Big White Ski Resort" }),
    ).toHaveAttribute("href", "/places/238661eb-e191-4d60-ae3d-748b4543964c");
  });

  it("a board item Atlas no longer returns is not rendered as an active experience", async () => {
    // `9cbac7c7` (Kalamalka Lake Provincial Park) is a real board item that was
    // archived by an approved merge. An archived entity is absent from
    // `/discovery/candidates`, so it must simply not appear — never as a card,
    // and never as a link to a page for a retired record.
    items = [
      {
        id: "item-2",
        boardId: "board-1",
        experienceId: "9cbac7c7-fee8-4247-af88-ddef90bb53c6",
        addedAt: "2026-08-11T13:32:03.610Z",
      },
    ];
    render(<DiscoveryListView experiences={experiences} />);
    await waitFor(() =>
      expect(
        screen.getByRole("link", { name: "Big White Ski Resort" }),
      ).toBeTruthy(),
    );
    expect(screen.queryByText("Kalamalka Lake Provincial Park")).toBeNull();
    expect(
      document.querySelector(
        'a[href="/places/9cbac7c7-fee8-4247-af88-ddef90bb53c6"]',
      ),
    ).toBeNull();
  });
});
