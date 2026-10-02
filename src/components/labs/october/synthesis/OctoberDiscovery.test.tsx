import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { OctoberDiscovery } from "./OctoberDiscovery";
import { emptyTray } from "../tray";
import { forgetEverythingKept } from "@/components/october/save/keeping";
import type { Possibility } from "@/lib/labs/october/possibility";
import type { Days } from "@/lib/labs/october/filters";

/**
 * **One session, four ways in.**
 *
 * The unit-level claims — filtering, search, ranking, intent — are tested
 * where they live. What can only be tested here is the composition the brief
 * actually asked for: that moving between the editorial opening, a phrase,
 * the search box, the filter panel and Trust Me is *one continuous session*
 * rather than four prototypes behind one stylesheet.
 *
 * So these are state-continuity tests. Nothing navigates, nothing resets, and
 * a Choice made in one mode is a Choice in all of them.
 */

const DAYS: Days = {
  today: "2026-10-01",
  tomorrow: "2026-10-02",
  weekend: ["2026-10-02", "2026-10-03", "2026-10-04"],
};

const make = (over: Partial<Possibility>): Possibility => ({
  id: "x",
  source: "atlas",
  title: "A thing",
  availability: {
    shape: "fixed",
    label: "THU OCT 1",
    days: ["2026-10-01"],
    tonight: true,
  },
  setting: "indoor",
  href: "/",
  text: "",
  tags: ["go-out"],
  keepAs: "Event",
  image: { src: "https://example.test/a.jpg", alt: "a photograph" },
  ...over,
});

const POOL: readonly Possibility[] = [
  make({ id: "gig", title: "Open Mic Comedy Night" }),
  make({
    id: "film",
    source: "movie",
    title: "Halloween",
    keepAs: "Movie",
    scare: 3,
    tags: ["stay-in", "watch"],
    text: "halloween a slasher",
    availability: {
      shape: "anytime",
      label: "ANY NIGHT · 1H 31M",
      days: [],
      tonight: true,
    },
  }),
  make({
    id: "doing",
    source: "doing",
    title: "Carve pumpkins",
    keepAs: "Doing",
    tags: ["stay-in", "make"],
    text: "pumpkin carving",
    image: undefined,
    availability: {
      shape: "anytime",
      label: "ANY NIGHT",
      days: [],
      tonight: true,
    },
  }),
];

const ctx = { today: DAYS.today, weather: {} };

function show(kept: readonly string[] = [], signedIn = true) {
  return render(
    <OctoberDiscovery
      possibilities={POOL}
      ctx={ctx}
      days={DAYS}
      weather={{}}
      areaName="Vernon, BC"
      signedIn={signedIn}
      kept={kept}
    />,
  );
}

const titles = () =>
  screen.queryAllByRole("heading", { level: 3 }).map((h) => h.textContent);
const asked = () =>
  screen.queryAllByTestId("asked-chip").map((c) => c.textContent?.trim());

beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(null, { status: 200 }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  forgetEverythingKept();
  emptyTray();
  // October remembers the wish for the tab; a test that left one behind
  // would hand it to the next case.
  sessionStorage.clear();
});

describe("arriving with no idea", () => {
  it("opens with October talking, not with a filter dashboard", () => {
    show();
    expect(screen.getByTestId("opening")).toBeInTheDocument();
    // One search field and one button. The thirteen filters stay behind it —
    // that is the disclosure, and it is the part that must not leak out.
    expect(screen.queryByTestId("filters")).toBeNull();
    expect(screen.getByLabelText(/search everything/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /browse & filter all/i }),
    ).toBeInTheDocument();
  });

  it("gives the hero to something with a photograph", () => {
    show();
    const lead = screen.getByTestId("lead");
    expect(within(lead).getByRole("img")).toBeInTheDocument();
  });

  it("cuts the world into sections rather than one long list", () => {
    show();
    expect(screen.getAllByTestId("section").length).toBeGreaterThan(0);
    expect(screen.queryByTestId("results")).toBeNull();
  });

  it("offers the phrases and Trust Me without being asked", () => {
    show();
    expect(screen.getAllByTestId("phrase").length).toBeGreaterThan(4);
    expect(screen.getByTestId("trust-me-open")).toBeInTheDocument();
  });
});

describe("one continuous session", () => {
  it("reshapes in place when a phrase is chosen — it does not navigate", () => {
    show();
    fireEvent.click(screen.getByText("make something"));
    expect(screen.queryByTestId("opening")).toBeNull();
    // The big opening collapses, but October itself stays on the page.
    expect(screen.getByTestId("asked")).toHaveTextContent(/vernon/i);
    expect(asked()).toEqual(["Make"]);
    expect(titles()).toEqual(["Carve pumpkins"]);
    // Still the same page: the phrases are still there to change your mind.
    expect(screen.getAllByTestId("phrase").length).toBeGreaterThan(4);
  });

  it("stacks a search on top of a phrase", () => {
    show();
    fireEvent.click(screen.getByText("stay in"));
    fireEvent.change(screen.getByLabelText(/search everything/i), {
      target: { value: "pumpkin" },
    });
    expect(asked()).toHaveLength(2);
    expect(titles()).toEqual(["Carve pumpkins"]);
  });

  it("stacks a filter on top of both", () => {
    show();
    fireEvent.click(screen.getByText("stay in"));
    fireEvent.click(screen.getByTestId("open-filters"));
    fireEvent.click(screen.getByRole("button", { name: "Watch" }));
    expect(titles()).toEqual(["Halloween"]);
  });

  it("takes one thing off without losing the rest", () => {
    show();
    fireEvent.click(screen.getByText("stay in"));
    fireEvent.click(screen.getByTestId("open-filters"));
    fireEvent.click(screen.getByRole("button", { name: "Watch" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Watch" }));
    expect(asked()).toEqual(["Stay in"]);
    expect(titles().sort()).toEqual(["Carve pumpkins", "Halloween"]);
  });

  it("goes back to October in one press", () => {
    show();
    fireEvent.click(screen.getByText("be frightened"));
    fireEvent.click(screen.getByRole("button", { name: /← October/ }));
    expect(screen.getByTestId("opening")).toBeInTheDocument();
    expect(asked()).toEqual([]);
  });
});

describe("Trust Me hands the session back", () => {
  it("asks two questions and leaves its answers on the page", async () => {
    show();
    fireEvent.click(screen.getByTestId("trust-me-open"));
    expect(screen.getByTestId("trust-me")).toBeInTheDocument();

    fireEvent.click(screen.getAllByTestId("fork-option")[0]); // Inside
    fireEvent.click(screen.getAllByTestId("fork-option")[0]); // An hour
    fireEvent.click(
      screen.getByRole("button", { name: /never mind|take me back/i }),
    );

    await waitFor(() => expect(screen.queryByTestId("trust-me")).toBeNull());
    // What it learned is now an ordinary, editable wish on the main surface.
    expect(asked()).toContain("Stay in");
  });

  it("deals from the same engine, not a second one", () => {
    show();
    fireEvent.click(screen.getByTestId("trust-me-open"));
    fireEvent.click(screen.getAllByTestId("fork-option")[0]); // Inside
    fireEvent.click(screen.getAllByTestId("fork-option")[1]); // Whole evening
    const card = screen.getByTestId("deal-card");
    // Inside → stay-in, so an Atlas gig can never be dealt here.
    expect(card.dataset.source).not.toBe("atlas");
  });
});

describe("a Choice means the same thing everywhere", () => {
  it("shows as chosen in the editorial view and in a filtered list", () => {
    show(["doing"]);
    fireEvent.click(screen.getByText("make something"));
    expect(screen.getByRole("button", { name: "Chosen" })).toBeInTheDocument();
  });

  it("survives choosing — the wish is still on the page afterwards", async () => {
    show();
    fireEvent.click(screen.getByText("make something"));
    fireEvent.click(screen.getByRole("button", { name: "Choose" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Chosen" }),
      ).toBeInTheDocument(),
    );
    expect(asked()).toEqual(["Make"]);
    expect(titles()).toEqual(["Carve pumpkins"]);
  });

  it("writes through the one October route", async () => {
    show();
    fireEvent.click(screen.getByText("make something"));
    fireEvent.click(screen.getByRole("button", { name: "Choose" }));
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    const [url, init] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(String(url)).toMatch(/^\/api\/october\/things\//);
    expect((init as RequestInit).method).toBe("PUT");
  });
});

describe("nothing matching is not a dead end", () => {
  it("says so and leaves every way out on screen", () => {
    show();
    fireEvent.change(screen.getByLabelText(/search everything/i), {
      target: { value: "snowmobiling" },
    });
    expect(screen.getByText(/nothing in october matches/i)).toBeInTheDocument();
    expect(screen.getAllByTestId("phrase").length).toBeGreaterThan(4);
    expect(
      screen.getByRole("button", { name: /clear everything/i }),
    ).toBeInTheDocument();
  });
});

describe("October stays present while the results change", () => {
  it("keeps the date, the place and the claim after a phrase is chosen", () => {
    render(
      <OctoberDiscovery
        possibilities={POOL}
        ctx={ctx}
        days={DAYS}
        weather={{ sky: "precipitating", wet: 0.9 }}
        areaName="Vernon, BC"
        signedIn
        kept={[]}
      />,
    );
    fireEvent.click(screen.getByText("be frightened"));
    const head = screen.getByTestId("asked");
    expect(head).toHaveTextContent(/thursday/i);
    expect(head).toHaveTextContent(/vernon/i);
    expect(head).toHaveTextContent(/rain tonight/i);
  });

  it("collapses the hero rather than the whole of October", () => {
    show();
    expect(screen.getByTestId("lead")).toBeInTheDocument();
    fireEvent.click(screen.getByText("be frightened"));
    // The photograph goes — a full-width hero above every filtered list is a
    // screen of scrolling before the answer.
    expect(screen.queryByTestId("lead")).toBeNull();
    // The ways in do not.
    expect(screen.getAllByTestId("phrase").length).toBeGreaterThan(4);
    expect(screen.getByLabelText(/search everything/i)).toBeInTheDocument();
  });
});

describe("a date is never dressed up as a photograph", () => {
  it("gives a tile with no picture a text treatment, not an empty frame", () => {
    // Found in use: "THU · 8 PM" centred in a tinted rectangle read as a
    // broken image rather than as a deliberate fallback.
    const noPhoto = POOL.map((p) =>
      p.id === "gig" ? { ...p, image: undefined } : p,
    );
    render(
      <OctoberDiscovery
        possibilities={noPhoto}
        ctx={ctx}
        days={DAYS}
        weather={{}}
        signedIn
        kept={[]}
      />,
    );
    const tiles = screen.queryAllByTestId("tile");
    for (const tile of tiles) {
      if (tile.dataset.hasImage === "false") {
        expect(tile.querySelector("img")).toBeNull();
        expect(tile.innerHTML).not.toContain("aspect-[");
      }
    }
  });
});

describe("the wish survives opening something", () => {
  it("comes back when the page is mounted again in the same tab", async () => {
    const { unmount } = show();
    fireEvent.change(screen.getByLabelText(/search everything/i), {
      target: { value: "pumpkin" },
    });
    fireEvent.click(screen.getByText("make something"));
    expect(asked()).toHaveLength(2);

    // Open a detail, come back: a fresh mount of the same page in the same tab.
    unmount();
    show();

    await waitFor(() => expect(asked()).toHaveLength(2));
    expect(
      (screen.getByLabelText(/search everything/i) as HTMLInputElement).value,
    ).toBe("pumpkin");
  });

  it("is forgotten once the person clears it", async () => {
    const { unmount } = show();
    fireEvent.click(screen.getByText("make something"));
    fireEvent.click(screen.getByRole("button", { name: /← October/ }));
    unmount();
    show();
    await waitFor(() =>
      expect(screen.getByTestId("opening")).toBeInTheDocument(),
    );
    expect(asked()).toEqual([]);
  });
});
