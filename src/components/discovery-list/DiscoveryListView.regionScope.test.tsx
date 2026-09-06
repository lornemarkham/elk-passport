import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import type { DiscoveryCandidate } from "@/lib/data/types";
import type { Board } from "@/lib/data/boards-repo";

/**
 * **The view honours the region scope it is given — through browse and search.**
 *
 * The unit tests pin `scopeToRegion`; these pin that the Discover list actually
 * passes its pool through it, which is the part that would silently regress.
 */
const OKANAGAN = "region-okanagan";
const VANCOUVER = "region-vancouver";

const board: Board = {
  id: "board-1",
  name: "board",
  ownerId: "owner-1",
  createdAt: "2026-08-09T00:00:00.000Z",
  updatedAt: "2026-08-09T00:00:00.000Z",
};
let items: {
  id: string;
  boardId: string;
  experienceId: string;
  addedAt: string;
}[] = [];
const saved = vi.fn(async (_boardId: string, experienceId: string) => ({
  id: `i-${experienceId}`,
  boardId: "board-1",
  experienceId,
  addedAt: "2026-09-06T00:00:00.000Z",
}));

vi.mock("@/lib/data/boards-repo", () => ({
  listBoards: async () => [board],
  getBoard: async () => board,
  listBoardItems: async () => items,
  createBoard: async () => board,
  saveExperienceToBoard: (b: string, e: string) => saved(b, e),
  removeExperienceFromBoard: async () => {},
  renameBoard: async () => board,
  deleteBoard: async () => {},
}));
vi.mock("@/lib/data/activeBoardStorage", () => ({
  getStoredActiveBoardId: () => "board-1",
  setStoredActiveBoardId: () => {},
  clearStoredActiveBoardId: () => {},
}));

const { DiscoveryListView } = await import("./DiscoveryListView");

const candidate = (over: Partial<DiscoveryCandidate>): DiscoveryCandidate => ({
  id: "id",
  kind: "Place",
  name: "Somewhere",
  description: "A description long enough to be real.",
  subtype: "park",
  heroUrl: "https://example.com/p.jpg",
  coordinates: [-119.4, 50.1],
  mediaCount: 0,
  containsCount: 0,
  regionIds: [],
  ...over,
});
const experiences = [
  candidate({ id: "ellison", name: "Ellison Park", regionIds: [OKANAGAN] }),
  candidate({ id: "stanley", name: "Stanley Park", regionIds: [VANCOUVER] }),
  candidate({
    id: "both",
    name: "Coquihalla Summit",
    regionIds: [OKANAGAN, VANCOUVER],
  }),
  candidate({ id: "unplaced", name: "Mt Moore", regionIds: [] }),
].map(candidateToExperience);

beforeEach(() => {
  items = [];
  saved.mockClear();
});

describe("the Discover list under a region scope", () => {
  it("shows every kind of entity when no region is active — today's behaviour", async () => {
    render(<DiscoveryListView experiences={experiences} />);
    await waitFor(() => expect(screen.getByText("Ellison Park")).toBeTruthy());
    for (const name of ["Stanley Park", "Coquihalla Summit", "Mt Moore"]) {
      expect(screen.getByText(name)).toBeTruthy();
    }
  });

  it("shows only the active region's entities, and never the unplaced ones", async () => {
    render(
      <DiscoveryListView experiences={experiences} activeRegionId={OKANAGAN} />,
    );
    await waitFor(() => expect(screen.getByText("Ellison Park")).toBeTruthy());
    expect(screen.getByText("Coquihalla Summit")).toBeTruthy();
    expect(screen.queryByText("Stanley Park")).toBeNull();
    expect(screen.queryByText("Mt Moore")).toBeNull();
  });

  it("the other region shows its own, and not the Okanagan's", async () => {
    render(
      <DiscoveryListView
        experiences={experiences}
        activeRegionId={VANCOUVER}
      />,
    );
    await waitFor(() => expect(screen.getByText("Stanley Park")).toBeTruthy());
    expect(screen.getByText("Coquihalla Summit")).toBeTruthy();
    expect(screen.queryByText("Ellison Park")).toBeNull();
  });

  it("a saved item keeps one identity, whichever region is scoped", async () => {
    // The board stores an entity id and nothing about regions, so an entity in
    // two regions is saved once rather than once per region.
    items = [
      {
        id: "i1",
        boardId: "board-1",
        experienceId: "both",
        addedAt: "2026-09-01T00:00:00.000Z",
      },
    ];
    const { unmount } = render(
      <DiscoveryListView experiences={experiences} activeRegionId={OKANAGAN} />,
    );
    const sidebar = await screen.findByRole("complementary");
    await waitFor(() =>
      expect(sidebar.textContent).toContain("Coquihalla Summit"),
    );
    unmount();

    render(
      <DiscoveryListView
        experiences={experiences}
        activeRegionId={VANCOUVER}
      />,
    );
    const other = await screen.findByRole("complementary");
    await waitFor(() =>
      expect(other.textContent).toContain("Coquihalla Summit"),
    );
  });
});
