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
 * **The loop a real person broke, start to finish.**
 *
 * They chose *Farms & markets*, said young child and half a day, typed `farm`,
 * found Kangaroo Creek Farm, pressed **Want to do**, were asked to sign in —
 * and came back to an empty Discovery with nothing kept. Then they opened the
 * board, came back, and had lost everything again.
 *
 * Every assertion below is one step of that loop.
 */

let url = new URL("https://passport.test/discovery");
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }),
  usePathname: () => "/discovery",
  useSearchParams: () => new URLSearchParams(url.search),
}));

const listBoards = vi.fn(async () => [BOARD]);
const listBoardItems = vi.fn(async () => [] as unknown[]);
const createBoard = vi.fn(async (name: string) => ({ ...BOARD, name }));
const saveExperienceToBoard = vi.fn(async (boardId: string, id: string) => ({
  id: `item-${id}`,
  boardId,
  experienceId: id,
  addedAt: "2026-10-10T00:00:00.000Z",
}));
const BOARD = {
  id: "board-1",
  ownerId: "ana",
  name: "My Places",
  createdAt: "2026-10-10T00:00:00.000Z",
  updatedAt: "2026-10-10T00:00:00.000Z",
};

vi.mock("@/lib/data/boards-repo", () => ({
  listBoards: () => listBoards(),
  getBoard: async () => null,
  listBoardItems: () => listBoardItems(),
  createBoard: (name: string) => createBoard(name),
  saveExperienceToBoard: (boardId: string, id: string) =>
    saveExperienceToBoard(boardId, id),
  removeExperienceFromBoard: async () => {},
  renameBoard: async () => {},
  deleteBoard: async () => {},
  isSignedOut: () => false,
}));

const wantToDo = vi.fn(async (thing: { entityId: string }) => ({
  entityId: thing.entityId,
  entityKind: "Place",
  name: "Kangaroo Creek Farm",
}));
vi.mock("@/lib/october/october-repo", () => ({
  listOctoberThings: async () => [],
  wantToDo: (thing: { entityId: string }) => wantToDo(thing),
}));

const toastFn = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => {
  const toast = (...args: unknown[]) => toastFn(...args);
  toast.error = (...args: unknown[]) => toastError(...args);
  toast.success = vi.fn();
  return { toast };
});

const { DiscoveryListView } = await import("./DiscoveryListView");

const candidate = (over: Partial<DiscoveryCandidate>): DiscoveryCandidate =>
  ({
    id: "id",
    kind: "Place",
    name: "Somewhere",
    description: "A description long enough to be real.",
    subtype: "farm",
    mediaCount: 0,
    containsCount: 0,
    regionIds: [],
    availability: {},
    ...over,
  }) as DiscoveryCandidate;

const EXPERIENCES = [
  candidate({ id: "kangaroo", name: "Kangaroo Creek Farm", subtype: "farm" }),
  candidate({ id: "gambell", name: "Gambell Farms", subtype: "farm" }),
  candidate({ id: "polson", name: "Polson Park", subtype: "park" }),
  // An Event, which is the kind that vanished between the sidebar and the
  // board in the reported screenshots.
  candidate({ id: "canyon", kind: "Event", name: "Canyon Frights" }),
].map(candidateToExperience);

function view(signedIn: boolean, at = "https://passport.test/discovery") {
  url = new URL(at);
  // The component mirrors the exploration with history.replaceState; jsdom
  // keeps that on its own location, which these read back.
  window.history.replaceState(
    null,
    "",
    at.replace("https://passport.test", ""),
  );
  return render(
    <DiscoveryListView
      experiences={EXPERIENCES}
      displayName={signedIn ? "Ana" : null}
      now="2026-10-10T18:00:00.000Z"
      today="Saturday, October 10"
    />,
  );
}

const here = () => window.location.search;

beforeEach(() => {
  listBoards.mockClear();
  listBoardItems.mockClear();
  listBoardItems.mockResolvedValue([]);
  createBoard.mockClear();
  saveExperienceToBoard.mockClear();
  wantToDo.mockClear();
  toastFn.mockClear();
  toastError.mockClear();
});

describe("the exploration is written down as it happens", () => {
  it("keeps a category, a search, a situation and a verb in the URL", async () => {
    view(false);
    fireEvent.click(screen.getByTestId("situation-child"));
    await waitFor(() => expect(here()).toContain("who=child"));
    fireEvent.click(screen.getByTestId("situation-half-day"));
    fireEvent.change(screen.getByPlaceholderText(/search/i), {
      target: { value: "farm" },
    });
    await waitFor(() => expect(here()).toContain("q=farm"));
    expect(here()).toContain("how=half-day");
  });

  it("starts where a link put it, which is what a refresh is", async () => {
    // A refresh is the browser handing the same URL back. If the page can be
    // linked into an exploration it can be refreshed inside one.
    view(
      false,
      "https://passport.test/discovery?q=farm&who=child&how=half-day",
    );
    expect(screen.getByPlaceholderText(/search/i)).toHaveValue("farm");
    expect(screen.getByTestId("situation-child")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByTestId("situation-half-day")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});

describe("being interrupted by sign-in", () => {
  it("carries the whole exploration and the press into the invitation", async () => {
    view(
      false,
      "https://passport.test/discovery?q=farm&who=child&how=half-day",
    );
    const card = screen
      .getAllByTestId("possibility")
      .find((c) => c.textContent?.includes("Kangaroo Creek Farm"))!;
    fireEvent.click(within(card).getByText("Save"));

    await waitFor(() => expect(toastFn).toHaveBeenCalled());
    const [, options] = toastFn.mock.calls.at(-1)!;
    // Capture where the Sign in action would send them.
    let sent = "";
    const location = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...location,
        set href(value: string) {
          sent = value;
        },
      },
    });
    (options as { action: { onClick: () => void } }).action.onClick();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: location,
    });

    const next = decodeURIComponent(sent.split("next=")[1] ?? "");
    // This used to be the literal string "/discovery".
    expect(next).toContain("q=farm");
    expect(next).toContain("who=child");
    expect(next).toContain("how=half-day");
    // The colon stays percent-encoded inside the `next` value, which is what
    // makes it survive being a query parameter of a query parameter.
    expect(next).toContain("do=save%3Akangaroo");
  });

  it("never writes on a visitor's behalf before they are known", () => {
    view(false);
    const card = screen
      .getAllByTestId("possibility")
      .find((c) => c.textContent?.includes("Kangaroo Creek Farm"))!;
    fireEvent.click(within(card).getByText("Save"));
    expect(saveExperienceToBoard).not.toHaveBeenCalled();
  });

  it("offers one action while browsing, not a choice of intentions", () => {
    // Asking somebody to grade their commitment before they have finished
    // looking is what made this confusing. Deciding happens in Saved.
    view(true);
    const card = screen.getAllByTestId("possibility")[0]!;
    expect(within(card).queryByTestId("want-to-do")).not.toBeInTheDocument();
    expect(within(card).getByText("Save")).toBeInTheDocument();
  });
});

describe("coming back signed in", () => {
  const RETURNED =
    "https://passport.test/discovery?intent=local&q=farm&who=child&how=half-day&do=want%3Akangaroo";

  it("does the thing they pressed before they were interrupted", async () => {
    view(true, RETURNED);
    await waitFor(() => expect(wantToDo).toHaveBeenCalledTimes(1));
    expect(wantToDo.mock.calls[0]![0]).toMatchObject({ entityId: "kangaroo" });
  });

  it("puts them back in the exploration they left", async () => {
    view(true, RETURNED);
    await waitFor(() => expect(wantToDo).toHaveBeenCalled());
    expect(screen.getByPlaceholderText(/search/i)).toHaveValue("farm");
    expect(screen.getByTestId("situation-child")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("clears the press from the URL so a refresh does not repeat it", async () => {
    view(true, RETURNED);
    await waitFor(() => expect(wantToDo).toHaveBeenCalled());
    expect(here()).not.toContain("do=");
    // ...and the exploration is still there.
    expect(here()).toContain("q=farm");
    expect(here()).toContain("who=child");
  });

  it("does it once, however many times the page renders", async () => {
    const { rerender } = view(true, RETURNED);
    await waitFor(() => expect(wantToDo).toHaveBeenCalledTimes(1));
    rerender(
      <DiscoveryListView
        experiences={EXPERIENCES}
        displayName="Ana"
        now="2026-10-10T18:00:00.000Z"
        today="Saturday, October 10"
      />,
    );
    await new Promise((r) => setTimeout(r, 20));
    expect(wantToDo).toHaveBeenCalledTimes(1);
  });

  it("saves to the board they already have rather than making a second one", async () => {
    view(true, "https://passport.test/discovery?do=save%3Apolson");
    await waitFor(() => expect(saveExperienceToBoard).toHaveBeenCalledTimes(1));
    expect(saveExperienceToBoard).toHaveBeenCalledWith("board-1", "polson");
    expect(createBoard).not.toHaveBeenCalled();
  });

  it("says so rather than silently dropping a thing Atlas no longer serves", async () => {
    view(true, "https://passport.test/discovery?do=save%3Avanished");
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(saveExperienceToBoard).not.toHaveBeenCalled();
  });
});

describe("the board stays theirs", () => {
  it("survives its contents failing to load", async () => {
    // These used to be one step, so a failed item fetch left the board null:
    // *Review board* vanished and the next save made a second "My Places".
    listBoardItems.mockRejectedValueOnce(new Error("network"));
    view(true);
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    const card = screen
      .getAllByTestId("possibility")
      .find((c) => c.textContent?.includes("Polson Park"))!;
    fireEvent.click(within(card).getByText("Save"));
    await waitFor(() => expect(saveExperienceToBoard).toHaveBeenCalled());
    expect(createBoard).not.toHaveBeenCalled();
    expect(saveExperienceToBoard).toHaveBeenCalledWith(
      "board-1",
      expect.any(String),
    );
  });
});

/**
 * **A stronger intention must not be a quieter one.**
 *
 * *Want to do* wrote only to this person's October, so the thing they had just
 * chosen never joined the collection Passport had been showing them — and the
 * board, which is where Passport said saved things live, never heard about it.
 */
/**
 * **A stronger intention must not be a quieter one.**
 *
 * *Want to do* used to write only to this person's October, so the thing they
 * had just chosen never joined the collection Passport had been showing them.
 * The card no longer offers it — deciding happens in Saved — but an older
 * `?do=want:` link still replays, and when it does it must collect first.
 */
describe("an older want-to-do link still collects", () => {
  it("puts it on the board before recording the intention", async () => {
    view(true, "https://passport.test/discovery?do=want%3Acanyon");
    await waitFor(() => expect(wantToDo).toHaveBeenCalled());
    expect(saveExperienceToBoard).toHaveBeenCalledWith("board-1", "canyon");
  });

  it("keeps it collected even where October cannot hold the kind", async () => {
    view(true, "https://passport.test/discovery?do=want%3Apolson");
    await waitFor(() => expect(saveExperienceToBoard).toHaveBeenCalled());
  });

  it("does not add a second row for something already collected", async () => {
    listBoardItems.mockResolvedValue([
      {
        id: "item-canyon",
        boardId: "board-1",
        experienceId: "canyon",
        addedAt: "2026-10-10T00:00:00.000Z",
      },
    ]);
    view(true, "https://passport.test/discovery?do=want%3Acanyon");
    await waitFor(() => expect(wantToDo).toHaveBeenCalled());
    expect(saveExperienceToBoard).not.toHaveBeenCalled();
  });
});

describe("the sidebar counts what is on the board", () => {
  it("says so rather than lowering the number it cannot name", async () => {
    listBoardItems.mockResolvedValue([
      {
        id: "item-1",
        boardId: "board-1",
        experienceId: "polson",
        addedAt: "2026-10-10T00:00:00.000Z",
      },
      {
        id: "item-2",
        boardId: "board-1",
        experienceId: "not-in-this-catalogue",
        addedAt: "2026-10-10T00:00:00.000Z",
      },
    ]);
    view(true);
    const sidebar = await screen.findByRole("complementary");
    await waitFor(() =>
      expect(sidebar).toHaveTextContent("2 experiences saved"),
    );
    expect(screen.getByTestId("unshown-saves")).toHaveTextContent(
      "1 of them is on your board but can't be shown here right now",
    );
  });
});
