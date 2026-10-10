import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import type { DiscoveryCandidate } from "@/lib/data/types";
import type { OctoberThing } from "@/lib/october/types";

/**
 * **"What did I collect, and which of these do I actually want to do?"**
 *
 * The page this replaces answered neither. It opened with *Who's on this
 * board* — a sharing panel above the things somebody had just saved — and the
 * route to it ran Discovery → My Places → Back to Boards → Your Boards → My
 * Places. Five screens and two pages with the same name, to look at four
 * saved items.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }),
  usePathname: () => "/saved",
  useSearchParams: () => new URLSearchParams(),
}));

const removeExperienceFromBoard = vi.fn(
  async (_boardId: string, _id: string) => {},
);
vi.mock("@/lib/data/boards-repo", () => ({
  removeExperienceFromBoard: (boardId: string, id: string) =>
    removeExperienceFromBoard(boardId, id),
}));

const wantToDo = vi.fn(async (_thing: { entityId: string }) => ({}) as never);
const forget = vi.fn(async (_id: string) => {});
vi.mock("@/lib/october/october-repo", () => ({
  wantToDo: (thing: { entityId: string }) => wantToDo(thing),
  forget: (id: string) => forget(id),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: toastSuccess, error: toastError },
}));

const { SavedReview } = await import("./SavedReview");

const candidate = (over: Partial<DiscoveryCandidate>): DiscoveryCandidate =>
  ({
    id: "id",
    kind: "Place",
    name: "Somewhere",
    description: "A description long enough to be real.",
    mediaCount: 0,
    containsCount: 0,
    regionIds: [],
    availability: {},
    ...over,
  }) as DiscoveryCandidate;

/** The kinds the board used to lose on the way from the sidebar. */
const COLLECTED = [
  candidate({ id: "kalamoir", name: "Kalamoir Park", kind: "Place" }),
  candidate({ id: "canyon", name: "Canyon Frights", kind: "Event" }),
  candidate({
    id: "swan",
    name: "Swan Lake Market & Garden",
    kind: "Organization",
  }),
].map(candidateToExperience);

const review = (over: Partial<Parameters<typeof SavedReview>[0]> = {}) =>
  render(
    <SavedReview
      boardId="board-1"
      boardName="My Places"
      experiences={COLLECTED}
      unresolved={[]}
      october={[]}
      back="/discovery?intent=local&q=farm"
      {...over}
    />,
  );

beforeEach(() => {
  removeExperienceFromBoard.mockClear();
  wantToDo.mockClear();
  forget.mockClear();
  toastSuccess.mockClear();
  toastError.mockClear();
});

describe("what somebody collected", () => {
  it("shows every kind, not only Places", () => {
    review();
    const said = screen.getByTestId("saved-review").textContent!;
    for (const name of [
      "Kalamoir Park",
      "Canyon Frights",
      "Swan Lake Market & Garden",
    ]) {
      expect(said).toContain(name);
    }
  });

  it("counts what is on the page, including what it cannot show", () => {
    review({ unresolved: ["gone-from-atlas"] });
    expect(screen.getByTestId("saved-review")).toHaveTextContent(
      "4 possibilities in My Places",
    );
    expect(screen.getByTestId("saved-unresolved")).toHaveTextContent(
      "1 saved item is still here but can't be shown",
    );
  });

  it("says nothing is saved only when nothing is", () => {
    review({ experiences: [], unresolved: [] });
    expect(screen.getByTestId("saved-review")).toHaveTextContent(
      "Nothing saved yet",
    );
  });

  it("does not claim an empty collection while something is unshowable", () => {
    review({ experiences: [], unresolved: ["a", "b"] });
    expect(screen.getByTestId("saved-review")).not.toHaveTextContent(
      "Nothing saved yet",
    );
    expect(screen.getByTestId("saved-unresolved")).toHaveTextContent("2 saved");
  });
});

describe("getting back to browsing", () => {
  it("is one link to exactly where they were", () => {
    review({ experiences: [] });
    expect(
      screen.getByText("Back to discovering").closest("a"),
    ).toHaveAttribute("href", "/discovery?intent=local&q=farm");
  });

  it("offers sharing without putting it first", () => {
    review();
    const page = screen.getByTestId("saved-review");
    const share = screen.getByTestId("share-this");
    // Present, and after the things somebody came here to look at.
    expect(share).toBeInTheDocument();
    expect(
      page.textContent!.indexOf("Kalamoir Park") <
        page.textContent!.indexOf("Share this collection"),
    ).toBe(true);
  });
});

describe("deciding, which happens here and not while browsing", () => {
  it("records a want against the same October a Thing already lives in", async () => {
    review();
    const card = screen
      .getAllByRole("listitem")
      .find((li) => li.textContent?.includes("Canyon Frights"))!;
    fireEvent.click(within(card).getByTestId("saved-want"));

    await waitFor(() => expect(wantToDo).toHaveBeenCalled());
    expect(wantToDo.mock.calls[0]![0]).toMatchObject({
      entityId: "canyon",
      entityKind: "Event",
      name: "Canyon Frights",
    });
  });

  it("shows what is already in October rather than offering it again", () => {
    const already: OctoberThing[] = [
      {
        entityId: "canyon",
        entityKind: "Event",
        name: "Canyon Frights",
        startsAt: null,
        state: "ahead",
        wantedAt: "2026-10-10T00:00:00.000Z",
        livedAt: null,
      },
    ];
    review({ october: already });
    const card = screen
      .getAllByRole("listitem")
      .find((li) => li.textContent?.includes("Canyon Frights"))!;
    expect(within(card).getByTestId("saved-wanted")).toHaveTextContent(
      "In My October",
    );
    expect(within(card).queryByTestId("saved-want")).not.toBeInTheDocument();
  });

  it("keeps the item in the collection after deciding", async () => {
    review();
    const card = screen
      .getAllByRole("listitem")
      .find((li) => li.textContent?.includes("Canyon Frights"))!;
    fireEvent.click(within(card).getByTestId("saved-want"));
    await waitFor(() => expect(wantToDo).toHaveBeenCalled());
    // A change of intention must never make something disappear.
    expect(screen.getByTestId("saved-review")).toHaveTextContent(
      "Canyon Frights",
    );
    expect(removeExperienceFromBoard).not.toHaveBeenCalled();
  });
});

describe("taking something out", () => {
  it("removes it from the collection", async () => {
    review();
    const card = screen
      .getAllByRole("listitem")
      .find((li) => li.textContent?.includes("Kalamoir Park"))!;
    fireEvent.click(within(card).getByTestId("saved-remove"));
    await waitFor(() => expect(removeExperienceFromBoard).toHaveBeenCalled());
    expect(screen.getByTestId("saved-review")).not.toHaveTextContent(
      "Kalamoir Park",
    );
  });

  it("takes its October intention with it", async () => {
    // An intention nobody can see any more is a thing somebody still means to
    // do, filed where they will never find it.
    review({
      october: [
        {
          entityId: "canyon",
          entityKind: "Event",
          name: "Canyon Frights",
          startsAt: null,
          state: "ahead",
          wantedAt: "2026-10-10T00:00:00.000Z",
          livedAt: null,
        },
      ],
    });
    const card = screen
      .getAllByRole("listitem")
      .find((li) => li.textContent?.includes("Canyon Frights"))!;
    fireEvent.click(within(card).getByTestId("saved-remove"));
    await waitFor(() => expect(forget).toHaveBeenCalledWith("canyon"));
  });

  it("leaves October alone for something that was never in it", async () => {
    review();
    const card = screen
      .getAllByRole("listitem")
      .find((li) => li.textContent?.includes("Kalamoir Park"))!;
    fireEvent.click(within(card).getByTestId("saved-remove"));
    await waitFor(() => expect(removeExperienceFromBoard).toHaveBeenCalled());
    expect(forget).not.toHaveBeenCalled();
  });

  it("keeps it where the removal failed, rather than lying about it", async () => {
    removeExperienceFromBoard.mockRejectedValueOnce(new Error("network"));
    review();
    const card = screen
      .getAllByRole("listitem")
      .find((li) => li.textContent?.includes("Kalamoir Park"))!;
    fireEvent.click(within(card).getByTestId("saved-remove"));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(screen.getByTestId("saved-review")).toHaveTextContent(
      "Kalamoir Park",
    );
  });
});

describe("a collection shared with somebody to look at", () => {
  it("offers no controls they cannot use", () => {
    review({ readOnly: true });
    expect(screen.queryByTestId("saved-remove")).not.toBeInTheDocument();
    expect(screen.queryByTestId("saved-want")).not.toBeInTheDocument();
    expect(screen.getByTestId("saved-review")).toHaveTextContent(
      "shared with you to look at",
    );
  });
});
