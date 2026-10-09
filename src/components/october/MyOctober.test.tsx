import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  vi,
  beforeEach,
} from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { OctoberThing } from "@/lib/october/types";

/**
 * **The only way anything becomes lived is the person saying so.**
 *
 * These pin the shape of My October rather than its looks: no counts in the
 * empty state, Ahead and Lived kept apart, "Did this" the sole path between
 * them, and nothing moving on its own.
 *
 * **The clock is frozen inside October.** The fixtures are written as real
 * October dates, and whether a dated thing is still ahead depends on today —
 * so without this the ordering test passed in early October and started
 * failing on the 9th, when the thing called "Sooner" quietly became the past.
 * A test that changes its answer with the wall clock is not a safety net.
 */
beforeAll(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date("2026-10-01T12:00:00.000Z"));
});
afterAll(() => vi.useRealTimers());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }),
  usePathname: () => "/october",
}));

const didThis = vi.fn<(id: string) => Promise<OctoberThing>>();
const forget = vi.fn<(id: string) => Promise<void>>(async () => {});
vi.mock("@/lib/october/october-repo", () => ({
  didThis: (id: string) => didThis(id),
  forget: (id: string) => forget(id),
}));

const saveReaction = vi.fn(async (filmId: string, r: unknown) => ({
  filmId,
  ...(r as Record<string, unknown>),
  reactedAt: "2026-10-13T04:00:00.000Z",
}));
vi.mock("@/lib/movies/movies-repo", () => ({
  saveReaction: (filmId: string, r: unknown) => saveReaction(filmId, r),
}));

const { MyOctober } = await import("./MyOctober");

const thing = (over: Partial<OctoberThing>): OctoberThing => ({
  entityId: "e1",
  entityKind: "Place",
  name: "Kekuli Bay",
  startsAt: null,
  state: "ahead",
  wantedAt: "2026-10-02T10:00:00.000Z",
  livedAt: null,
  ...over,
});

beforeEach(() => {
  didThis.mockReset();
  forget.mockClear();
  saveReaction.mockClear();
});

describe("an empty October", () => {
  it("does not count anything", () => {
    render(<MyOctober things={[]} experiences={[]} />);
    const text = screen.getByTestId("october-empty").textContent ?? "";
    expect(text).not.toMatch(/\b0\b/);
    expect(text).not.toMatch(/activities|events|completed/i);
    expect(screen.getByText(/Find something/)).toBeTruthy();
  });
});

describe("ahead and lived", () => {
  it("keeps what is meant apart from what was done", () => {
    render(
      <MyOctober
        things={[
          thing({ entityId: "a", name: "Kekuli Bay" }),
          thing({
            entityId: "b",
            name: "Apple Harvest Fest",
            entityKind: "Event",
            state: "lived",
            livedAt: "2026-10-05T20:00:00.000Z",
          }),
        ]}
        experiences={[]}
      />,
    );
    expect(screen.getAllByTestId("ahead-thing")).toHaveLength(1);
    expect(screen.getAllByTestId("lived-thing")).toHaveLength(1);
    expect(screen.getByTestId("october-lived").textContent).toContain(
      "Apple Harvest Fest",
    );
  });

  it("puts dated things first in Ahead, soonest first", () => {
    render(
      <MyOctober
        things={[
          thing({
            entityId: "later",
            name: "Later",
            startsAt: "2026-10-20T00:00:00.000Z",
            entityKind: "Event",
          }),
          thing({ entityId: "undated", name: "Undated" }),
          thing({
            entityId: "sooner",
            name: "Sooner",
            startsAt: "2026-10-09T00:00:00.000Z",
            entityKind: "Event",
          }),
        ]}
        experiences={[]}
      />,
    );
    const names = screen
      .getAllByTestId("ahead-thing")
      .map((li) => li.textContent);
    expect(names[0]).toContain("Sooner");
    expect(names[1]).toContain("Later");
    expect(names[2]).toContain("Undated");
  });

  it("moves a thing to Lived only when the person says they did it", async () => {
    didThis.mockResolvedValueOnce(
      thing({
        entityId: "a",
        state: "lived",
        livedAt: "2026-10-08T21:00:00.000Z",
      }),
    );
    render(<MyOctober things={[thing({ entityId: "a" })]} experiences={[]} />);

    expect(screen.queryAllByTestId("lived-thing")).toHaveLength(0);
    fireEvent.click(screen.getByTestId("did-this"));

    await waitFor(() =>
      expect(screen.getAllByTestId("lived-thing")).toHaveLength(1),
    );
    expect(screen.queryAllByTestId("ahead-thing")).toHaveLength(0);
    expect(didThis).toHaveBeenCalledWith("a");
  });

  it("never marks anything lived on its own", () => {
    // Render, wait, click nothing. Nothing moves.
    render(<MyOctober things={[thing({ entityId: "a" })]} experiences={[]} />);
    expect(screen.queryAllByTestId("lived-thing")).toHaveLength(0);
    expect(didThis).not.toHaveBeenCalled();
  });

  it("lets the person change their mind", async () => {
    render(<MyOctober things={[thing({ entityId: "a" })]} experiences={[]} />);
    fireEvent.click(screen.getByTestId("forget"));
    await waitFor(() =>
      expect(screen.queryAllByTestId("ahead-thing")).toHaveLength(0),
    );
    expect(forget).toHaveBeenCalledWith("a");
  });

  it("shows a thing by its remembered name even when Atlas no longer returns it", () => {
    // No experiences passed at all — every row still renders from the snapshot.
    render(
      <MyOctober
        things={[thing({ name: "Somewhere Retired" })]}
        experiences={[]}
      />,
    );
    expect(screen.getByText("Somewhere Retired")).toBeTruthy();
  });
});

/**
 * **A film is a thing you mean to do in October.**
 *
 * `Movie` is the one kind whose id names nothing in Atlas, so every row here
 * renders from its own snapshot and from Passport's catalogue. It was also the
 * kind that could not be saved at all until 2026-09-30, which is why the
 * reaction below had never once been reachable.
 */
describe("a film in My October", () => {
  const film = (over: Partial<OctoberThing> = {}): OctoberThing =>
    thing({
      entityId: "great-pumpkin",
      entityKind: "Movie",
      name: "It's the Great Pumpkin, Charlie Brown (1966)",
      ...over,
    });

  it("waits in Ahead like anything else", () => {
    render(<MyOctober things={[film()]} experiences={[]} />);
    const ahead = screen.getAllByTestId("ahead-thing");
    expect(ahead).toHaveLength(1);
    expect(ahead[0]!.textContent).toContain("Great Pumpkin");
  });

  it("moves to Lived when the person says they watched it", async () => {
    didThis.mockResolvedValueOnce(
      film({ state: "lived", livedAt: "2026-10-13T04:00:00.000Z" }),
    );
    render(<MyOctober things={[film()]} experiences={[]} />);
    fireEvent.click(screen.getByTestId("did-this"));
    await waitFor(() =>
      expect(screen.getAllByTestId("lived-thing")).toHaveLength(1),
    );
  });

  it("can then be asked what it was like", () => {
    // The reachability this slice restored: a lived Movie, and the two taps.
    render(
      <MyOctober
        things={[film({ state: "lived", livedAt: "2026-10-13T04:00:00.000Z" })]}
        experiences={[]}
      />,
    );
    expect(screen.getByTestId("verdict")).toBeTruthy();
  });

  it("keeps what they said about it", async () => {
    // Great Pumpkin is catalogued `cozy`, so answering `spooky` is a surprise
    // and earns the third question (`shouldAskWhat`). Nothing is saved until
    // that one is answered too.
    render(
      <MyOctober
        things={[film({ state: "lived", livedAt: "2026-10-13T04:00:00.000Z" })]}
        experiences={[]}
      />,
    );
    fireEvent.click(screen.getByTestId("verdict-loved"));
    fireEvent.click(await screen.findByTestId("felt-spooky"));

    const third = await screen.findByTestId("what-got-you");
    expect(saveReaction).not.toHaveBeenCalled();
    fireEvent.click(third.querySelector("button")!);

    await waitFor(() => expect(saveReaction).toHaveBeenCalled());
    const [filmId, reaction] = saveReaction.mock.calls[0]!;
    expect(filmId).toBe("great-pumpkin");
    expect(reaction).toMatchObject({ verdict: "loved", felt: "spooky" });
  });

  it("saves without the third question when the answer was unremarkable", async () => {
    render(
      <MyOctober
        things={[film({ state: "lived", livedAt: "2026-10-13T04:00:00.000Z" })]}
        experiences={[]}
      />,
    );
    fireEvent.click(screen.getByTestId("verdict-good"));
    // `cozy` is exactly what the catalogue expected of this one.
    fireEvent.click(await screen.findByTestId("felt-cozy"));

    await waitFor(() => expect(saveReaction).toHaveBeenCalled());
    expect(screen.queryByTestId("what-got-you")).toBeNull();
  });

  it("does not offer a reaction for anything that is not a film", () => {
    render(
      <MyOctober
        things={[
          thing({ state: "lived", livedAt: "2026-10-13T04:00:00.000Z" }),
        ]}
        experiences={[]}
      />,
    );
    expect(screen.queryByTestId("verdict")).toBeNull();
  });
});

/**
 * Finding something next is finding something in **October**. Both of these
 * pointed at `/discovery` — Passport's general list, outside October's shell,
 * with no way back into the month.
 */
describe("where My October sends you next", () => {
  const hrefs = () =>
    Array.from(document.querySelectorAll("a")).map((a) =>
      a.getAttribute("href"),
    );

  it("sends an empty October to October's own Discover", () => {
    render(<MyOctober things={[]} experiences={[]} />);
    expect(hrefs()).toContain("/october/discover");
    expect(hrefs()).not.toContain("/discovery");
  });

  it("sends an October with nothing Ahead to the same place", () => {
    render(
      <MyOctober
        things={[
          thing({ state: "lived", livedAt: "2026-10-13T04:00:00.000Z" }),
        ]}
        experiences={[]}
      />,
    );
    expect(hrefs()).toContain("/october/discover");
    expect(hrefs()).not.toContain("/discovery");
  });
});

/**
 * **My October is inside October.**
 *
 * This page used to paint its own full-screen cream world — `#ecdfc4`, a
 * radial wash and the Passport account control — *underneath* October's dark
 * nav bar, so signing in changed the colour of the month. The shell belongs
 * to `/october/layout.tsx`; this renders into it and paints no ground of its
 * own.
 */
describe("the world My October is drawn in", () => {
  const CREAM = ["#ecdfc4", "#2b2015", "#8a5a24", "#f7ecd3", "#efe7d8"];

  it("paints no background of its own", () => {
    const { container } = render(
      <MyOctober things={[thing({})]} experiences={[]} />,
    );
    const main = container.querySelector("main")!;
    expect(main.className).not.toMatch(/bg-/);
    expect(main.getAttribute("style")).toBeNull();
  });

  it("uses none of the cream palette", () => {
    const { container } = render(
      <MyOctober
        things={[
          thing({}),
          thing({
            entityId: "b",
            state: "lived",
            livedAt: "2026-10-13T04:00:00.000Z",
          }),
        ]}
        experiences={[]}
      />,
    );
    for (const token of CREAM) {
      expect(container.innerHTML).not.toContain(token);
    }
  });

  it("leaves the account to the nav bar, which already has it", () => {
    const { container } = render(<MyOctober things={[]} experiences={[]} />);
    expect(container.textContent).not.toMatch(/sign out/i);
  });
});
