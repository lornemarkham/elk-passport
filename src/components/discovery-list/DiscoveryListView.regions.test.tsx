import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import type { DiscoveryCandidate } from "@/lib/data/types";

/**
 * **Metro Vancouver is a launch region, not a future phase.**
 *
 * Measured on production on 2026-10-11, opening Discovery as somebody in
 * Vancouver would:
 *
 * ```
 * town picker        21 Okanagan towns, none nearer than Osoyoos
 * the page said      "2,189 ideas in Okanagan"
 * their own area     suppressed — "34 more in Metro Vancouver — show them too"
 * ```
 *
 * The cause was one line: the page's home area was `dominantArea(corpus)`,
 * which is a fact about what Atlas mostly holds, used as though it were a
 * fact about the person reading. These pin the fix in both directions — a
 * Vancouver reader is not shown an Okanagan page, and an Okanagan reader is
 * not shown a Vancouver one.
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

const placed = (name: string, area: string): DiscoveryCandidate => ({
  id: name.toLowerCase().replace(/\W+/g, "-"),
  kind: "Place",
  name,
  subtype: "park",
  description: "A description long enough to be real.",
  mediaCount: 0,
  containsCount: 0,
  regionIds: [],
  geography: {
    state: "observed",
    area: { id: area.toLowerCase().replace(/\W+/g, "-"), name: area },
  },
});

/** Seven Okanagan to three Vancouver, which is roughly the corpus's own ratio. */
const pool = [
  ...Array.from({ length: 7 }, (_, i) =>
    placed(`Okanagan park ${i}`, "Okanagan"),
  ),
  placed("Stanley Park", "Metro Vancouver"),
  placed("Capilano Suspension Bridge", "Metro Vancouver"),
  placed("Queen Elizabeth Park", "Metro Vancouver"),
].map(candidateToExperience);

const renderPage = () =>
  render(
    <DiscoveryListView
      experiences={pool}
      displayName={null}
      now="2026-10-11T18:00:00.000Z"
      today="Sunday, October 11"
    />,
  );

const shown = () =>
  screen.getAllByTestId("possibility").map((c) => c.textContent ?? "");

beforeEach(() => {
  vi.clearAllMocks();
  search = new URLSearchParams();
});

describe("a reader in Vancouver", () => {
  it("can say so", () => {
    renderPage();
    const options = [
      ...screen.getByTestId("ghad-town").querySelectorAll("option"),
    ].map((o) => o.textContent);
    expect(options).toContain("Vancouver, BC");
    expect(options).toContain("Burnaby, BC");
  });

  it("is not told they are looking at the Okanagan", () => {
    search = new URLSearchParams("at=vancouver");
    renderPage();
    expect(screen.getByTestId("answer-summary")).not.toHaveTextContent(
      "Okanagan",
    );
  });

  it("gets the things near them, not a link offering to show them", () => {
    search = new URLSearchParams("at=vancouver");
    renderPage();
    expect(shown().some((t) => t.includes("Stanley Park"))).toBe(true);
    expect(shown().some((t) => t.includes("Capilano"))).toBe(true);
  });

  it("has the valley held back instead, and named", () => {
    search = new URLSearchParams("at=vancouver");
    renderPage();
    expect(shown().some((t) => t.includes("Okanagan park"))).toBe(false);
    expect(screen.getByTestId("further-afield")).toHaveTextContent("Okanagan");
  });
});

describe("a reader in the Okanagan", () => {
  it("still gets the valley, with Vancouver one named tap away", () => {
    search = new URLSearchParams("at=vernon");
    renderPage();
    expect(shown().some((t) => t.includes("Okanagan park"))).toBe(true);
    expect(shown().some((t) => t.includes("Stanley Park"))).toBe(false);
    expect(screen.getByTestId("further-afield")).toHaveTextContent(
      "Metro Vancouver",
    );
  });

  it("gets the corpus's own area when nobody has said where they are", () => {
    // A fact about Atlas, used only where there is nothing better.
    renderPage();
    expect(shown().some((t) => t.includes("Okanagan park"))).toBe(true);
    expect(screen.getByTestId("further-afield")).toHaveTextContent(
      "Metro Vancouver",
    );
  });
});
