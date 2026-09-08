import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import type { DiscoveryCandidate } from "@/lib/data/types";

/**
 * **Passport gives before it asks.**
 *
 * A visitor who has never signed in gets the whole of Discovery — the feed, the
 * scope, search, kinds, every card and every link. Identity is requested at
 * exactly one moment, when they try to keep something, and even then the page
 * stays where it is.
 *
 * These pin the three ways that could quietly break: a board request fired at
 * somebody with no session (401s and an error toast on every page view), a
 * signup wall in front of browsing, and a save button that silently does
 * nothing.
 */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }),
  usePathname: () => "/discovery",
  useSearchParams: () => new URLSearchParams(),
}));

const listBoards = vi.fn(async () => []);
const listBoardItems = vi.fn(async () => []);
const saveExperienceToBoard = vi.fn(async () => {
  throw new Error("a signed-out visitor must never reach a board write");
});

vi.mock("@/lib/data/boards-repo", () => ({
  listBoards: () => listBoards(),
  getBoard: async () => null,
  listBoardItems: () => listBoardItems(),
  createBoard: async () => {
    throw new Error("no board creation while signed out");
  },
  saveExperienceToBoard: () => saveExperienceToBoard(),
  removeExperienceFromBoard: async () => {},
  renameBoard: async () => {},
  deleteBoard: async () => {},
  isSignedOut: () => false,
}));

const toastFn = vi.fn();
vi.mock("sonner", () => {
  const toast = (...args: unknown[]) => toastFn(...args);
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
  heroUrl: "https://example.com/p.jpg",
  coordinates: [-119.4, 50.1],
  mediaCount: 0,
  containsCount: 0,
  regionIds: [],
  ...over,
});

const experiences = [
  candidate({ id: "ellison", name: "Ellison Park" }),
  candidate({ id: "kekuli", name: "Kekuli Bay", subtype: "beach" }),
].map(candidateToExperience);

beforeEach(() => {
  listBoards.mockClear();
  listBoardItems.mockClear();
  saveExperienceToBoard.mockClear();
  toastFn.mockClear();
});

describe("Discovery for someone who has not signed in", () => {
  it("shows the whole catalogue, with no wall in front of it", async () => {
    render(<DiscoveryListView experiences={experiences} displayName={null} />);

    await waitFor(() => expect(screen.getByText("Ellison Park")).toBeTruthy());
    expect(screen.getByText("Kekuli Bay")).toBeTruthy();
  });

  it("still searches and narrows", async () => {
    render(<DiscoveryListView experiences={experiences} displayName={null} />);

    fireEvent.change(screen.getByPlaceholderText(/search/i), {
      target: { value: "Kekuli" },
    });

    await waitFor(() => expect(screen.queryByText("Ellison Park")).toBeNull());
    expect(screen.getByText("Kekuli Bay")).toBeTruthy();
  });

  it("never asks Atlas for boards it knows nobody owns", async () => {
    render(<DiscoveryListView experiences={experiences} displayName={null} />);

    await waitFor(() => expect(screen.getByText("Ellison Park")).toBeTruthy());

    // Every one of these would have been a 401 and a red toast, on every single
    // page view, at somebody who has done nothing wrong.
    expect(listBoards).not.toHaveBeenCalled();
    expect(listBoardItems).not.toHaveBeenCalled();
  });

  it("offers a way in, and does not pretend to be signed in", () => {
    render(<DiscoveryListView experiences={experiences} displayName={null} />);

    expect(screen.getByTestId("sign-in-link")).toBeTruthy();
    expect(screen.queryByTestId("account-control")).toBeNull();
  });

  it("invites a sign-in when saving, instead of failing quietly", async () => {
    render(<DiscoveryListView experiences={experiences} displayName={null} />);

    await waitFor(() => expect(screen.getByText("Ellison Park")).toBeTruthy());
    fireEvent.click(screen.getAllByRole("button", { name: /save/i })[0]!);

    expect(saveExperienceToBoard).not.toHaveBeenCalled();
    expect(toastFn).toHaveBeenCalledWith(
      "Sign in to keep this",
      expect.objectContaining({
        action: expect.objectContaining({ label: "Sign in" }),
      }),
    );
  });
});

describe("Discovery for someone signed in", () => {
  it("says who they are and loads their boards", async () => {
    render(<DiscoveryListView experiences={experiences} displayName="Ana" />);

    await waitFor(() => expect(listBoards).toHaveBeenCalled());
    expect(screen.getByTestId("account-name").textContent).toBe("Ana");
    expect(screen.queryByTestId("sign-in-link")).toBeNull();
  });
});
