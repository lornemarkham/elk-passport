import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import {
  DiscoveryListSidebar,
  type SavedListItem,
} from "./DiscoveryListSidebar";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import type { DiscoveryCandidate } from "@/lib/data/types";
import type { Board } from "@/lib/data/boards-repo";

/**
 * **A saved item is reachable exactly when its card would have been.**
 *
 * The board uses `destinationFor` — the same function the cards use — rather
 * than a routing rule of its own. So an Organization never reaches
 * `/places/{organizationId}`, an Activity never reaches `/places/{activityId}`,
 * and a Place with nothing to fill a page with stays plain text here for the
 * same reason its card carries no link.
 */
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

const saved = (over: Partial<DiscoveryCandidate>): SavedListItem => ({
  experience: candidateToExperience(candidate(over)),
  addedAt: "2026-08-11T13:31:43.515Z",
});

const board: Board = {
  id: "board-1",
  name: "third board 2",
  ownerId: "owner-1",
  createdAt: "2026-08-09T00:00:00.000Z",
  updatedAt: "2026-08-09T00:00:00.000Z",
};

function renderSidebar(savedItems: SavedListItem[], onRemoveSaved = vi.fn()) {
  render(
    <DiscoveryListSidebar
      boards={[board]}
      board={board}
      boardsLoaded
      savedItems={savedItems}
      onSwitchBoard={vi.fn()}
      onCreateBoard={vi.fn()}
      onRenameBoard={vi.fn()}
      onRequestDeleteBoard={vi.fn()}
      onRemoveSaved={onRemoveSaved}
    />,
  );
  return { onRemoveSaved, sidebar: screen.getByRole("complementary") };
}

const ELLISON = {
  id: "eddd9851-b490-45ad-bb20-cb21e7d9e27f",
  name: "Ellison Provincial Park",
  subtype: "provincial park",
  heroUrl: "https://example.com/ellison.jpg",
  coordinates: [-119.43333333, 50.17361111] as [number, number],
};

describe("saved items that can be navigated to", () => {
  it("links a detail-ready Place to its own page", () => {
    const { sidebar } = renderSidebar([saved(ELLISON)]);
    expect(
      within(sidebar).getByRole("link", { name: "Ellison Provincial Park" }),
    ).toHaveAttribute("href", "/places/eddd9851-b490-45ad-bb20-cb21e7d9e27f");
  });

  it("links an Organization to itself, never to /places/{organizationId}", () => {
    const { sidebar } = renderSidebar([
      saved({
        id: "org-bullwheel",
        kind: "Organization",
        name: "The BullWheel",
        subtype: "restaurant",
        heroUrl: "https://example.com/bullwheel.jpg",
        context: {
          id: "place-bigwhite",
          kind: "Place",
          name: "Big White Ski Resort",
        },
      }),
    ]);
    const link = within(sidebar).getByRole("link", { name: "The BullWheel" });
    expect(link).toHaveAttribute("href", "/passport/org-bullwheel");
    expect(link.getAttribute("href")).not.toContain("/places/");
  });
});

describe("saved items the Place template cannot hold", () => {
  it("still opens a Place that is not detail-ready, on the neutral page", () => {
    // Kekuli Bay: real and mapped, and Atlas holds no photograph for it.
    const { sidebar } = renderSidebar([
      saved({
        id: "1d8a002c-a7ac-41d5-9a3e-73ab0849e702",
        name: "Kekuli Bay Provincial Park",
        subtype: "provincial park",
        coordinates: [-119.34027778, 50.18333333],
      }),
    ]);
    // It has no photograph, so the Place template would render badly — but
    // a saved thing you cannot reopen is worse than a page with honest gaps.
    expect(
      within(sidebar).getByRole("link", { name: "Kekuli Bay Provincial Park" }),
    ).toHaveAttribute("href", "/passport/1d8a002c-a7ac-41d5-9a3e-73ab0849e702");
  });

  it("never routes an Organization without context through /places/{id}", () => {
    const { sidebar } = renderSidebar([
      saved({
        id: "b67aab15-31fe-4c8e-b024-2bebd8c1aeec",
        kind: "Organization",
        name: "Pallino's Italian Bistro",
        subtype: "restaurant",
      }),
    ]);
    expect(within(sidebar).getByText("Pallino's Italian Bistro")).toBeTruthy();
    expect(sidebar.querySelector('a[href^="/places/"]')).toBeNull();
  });

  it("never routes an Activity through /places/{id}", () => {
    const { sidebar } = renderSidebar([
      saved({
        id: "activity-night-skiing",
        kind: "Activity",
        name: "night skiing",
        subtype: "skiing",
        heroUrl: "https://example.com/night.jpg",
      }),
    ]);
    expect(within(sidebar).getByText("night skiing")).toBeTruthy();
    expect(sidebar.querySelector('a[href^="/places/"]')).toBeNull();
  });

  it("manufactures no link for a board item Atlas no longer returns", () => {
    // An archived entity is absent from the candidates, so it never becomes a
    // SavedListItem at all — the board simply has nothing to show for it.
    const { sidebar } = renderSidebar([]);
    expect(sidebar.querySelector('a[href^="/places/"]')).toBeNull();
    // An empty board no longer prints a filing cabinet and a count of zero at
    // somebody who has not picked anything up yet; it says what it is for.
    expect(sidebar.dataset.testid).toBe("board-empty");
  });
});

describe("everything else the board already did", () => {
  it("still removes a linked item from the board", () => {
    const onRemove = vi.fn();
    const { sidebar } = renderSidebar([saved(ELLISON)], onRemove);
    fireEvent.click(
      within(sidebar).getByRole("button", {
        name: "Remove Ellison Provincial Park from board",
      }),
    );
    expect(onRemove).toHaveBeenCalledWith(
      "eddd9851-b490-45ad-bb20-cb21e7d9e27f",
    );
  });

  it("offers the board its own page, not a Passport that does not exist", () => {
    // Was "Start Passport" -> `/passport/board-1`, which resolves an *entity*
    // id and 404s on a board's. No board-level Passport exists; see
    // docs/product/discover.md.
    const { sidebar } = renderSidebar([saved(ELLISON)]);
    // "Review board" asked somebody to know what a board was before they
    // could look at four things they had just saved.
    const cta = within(sidebar).getByText("Review saved").closest("a");
    expect(cta).toHaveAttribute("href", "/saved");
    expect(within(sidebar).queryByText("Start Passport")).toBeNull();
    expect(sidebar.querySelector('a[href^="/passport/"]')).toBeNull();
  });
});

/**
 * **Reviewing a board used to be a one-way trip.**
 *
 * The board's *Continue discovering* went to a bare `/discovery`, so the
 * category, the search and the situation somebody had built up were gone by
 * the time they got back. A real person lost an exploration this way twice in
 * one sitting.
 */
describe("the way back", () => {
  it("carries the exploration to the board so the board can return it", () => {
    render(
      <DiscoveryListSidebar
        boards={[board]}
        board={board}
        boardsLoaded
        savedItems={[saved({ id: "a", name: "Kangaroo Creek Farm" })]}
        onSwitchBoard={vi.fn()}
        onCreateBoard={vi.fn()}
        onRenameBoard={vi.fn()}
        onRequestDeleteBoard={vi.fn()}
        onRemoveSaved={vi.fn()}
        backHref="/discovery?intent=local&q=farm&who=child"
      />,
    );
    expect(screen.getByText("Review saved").closest("a")).toHaveAttribute(
      "href",
      "/saved?back=%2Fdiscovery%3Fintent%3Dlocal%26q%3Dfarm%26who%3Dchild",
    );
  });

  it("links plainly where there is no exploration to come back to", () => {
    render(
      <DiscoveryListSidebar
        boards={[board]}
        board={board}
        boardsLoaded
        savedItems={[saved({ id: "a", name: "Kangaroo Creek Farm" })]}
        onSwitchBoard={vi.fn()}
        onCreateBoard={vi.fn()}
        onRenameBoard={vi.fn()}
        onRequestDeleteBoard={vi.fn()}
        onRemoveSaved={vi.fn()}
      />,
    );
    expect(screen.getByText("Review saved").closest("a")).toHaveAttribute(
      "href",
      "/saved",
    );
  });
});
