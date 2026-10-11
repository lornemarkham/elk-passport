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
/**
 * Intent lives in the URL now, so the mock has to behave like one: `replace`
 * writes the query and `useSearchParams` reads it back. A router mock that
 * swallows navigation would make every intent assertion below pass against a
 * page that never changed.
 */
let search = new URLSearchParams();
const rerenders: (() => void)[] = [];
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: () => {},
    push: () => {},
    replace: (url: string) => {
      search = new URLSearchParams(url.startsWith("?") ? url.slice(1) : "");
      for (const r of rerenders) r();
    },
  }),
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

const renderPage = (displayName: string | null = null) => {
  const view = render(
    <DiscoveryListView
      experiences={pool}
      displayName={displayName}
      now={NOW}
      today="Saturday, October 10"
    />,
  );
  rerenders.push(() =>
    view.rerender(
      <DiscoveryListView
        experiences={pool}
        displayName={displayName}
        now={NOW}
        today="Saturday, October 10"
      />,
    ),
  );
  return view;
};

beforeEach(() => {
  vi.clearAllMocks();
  search = new URLSearchParams();
  rerenders.length = 0;
});

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
    // GO HAVE A DAY asks it in the second person and in a person's own words.
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /what do you feel like doing/i,
      }),
    ).toBeTruthy();
  });

  it("does not open with a row count presented as a product fact", () => {
    renderPage();
    // "2248 to explore" was the page's answer to "what could I do?".
    expect(screen.queryByTestId("result-summary")).toBeNull();
  });
});

/**
 * **"What do you feel like doing?" replaced a row of Atlas's filing cabinet.**
 *
 * The chips used to be `outside / eat / culture / stay` — Passport's own
 * five-word taxonomy, which is nearer to a person than `Organization 1,584`
 * and still not a thing anybody says. What is offered now is the verb **Atlas
 * itself states** for the places on the page, counted, and nothing else.
 *
 * These pin the rule the whole row exists for: a control either narrows real
 * evidence or admits out loud that it cannot. There is no third state where
 * something looks like a filter and does nothing.
 */
describe("the controls, and what they are allowed to claim", () => {
  const verbs = (row: string) =>
    screen
      .getAllByTestId("ghad-choice")
      .filter((b) => b.dataset.row === row)
      .map((b) => b.textContent?.replace(/\d+$/, "").trim());

  it("offers the verbs Atlas states, and no others", () => {
    render(
      <DiscoveryListView
        experiences={[
          candidate({
            id: "lake",
            name: "Otter Lake Park",
            knowledge: {
              affordances: [
                { name: "swimming", basis: "stated-activity" },
                { name: "fishing", basis: "stated-activity" },
              ],
            },
          }),
          candidate({
            id: "rail",
            name: "Okanagan Rail Trail",
            knowledge: {
              affordances: [{ name: "cycling", basis: "stated-activity" }],
            },
          }),
        ].map(candidateToExperience)}
        displayName={null}
        now={NOW}
        today="Saturday, October 10"
      />,
    );
    expect(verbs("activity")).toEqual(
      expect.arrayContaining(["swimming", "fishing", "cycling"]),
    );
    // Nothing on this page states skiing, so skiing is never on offer.
    expect(verbs("activity")).not.toContain("skiing");
  });

  it("says so rather than offering a control that cannot narrow anything", () => {
    // This pool is a concert, a talk, a festival, a park and a winery, and
    // Atlas states an affordance for none of them. The old page would have
    // printed chips anyway.
    renderPage();
    expect(verbs("activity")).toEqual([]);
    expect(
      screen.getAllByTestId("ghad-note").map((n) => n.textContent),
    ).toEqual(expect.arrayContaining([expect.stringContaining("224")]));
  });

  it("never offers a distance it has nowhere to measure from", () => {
    // Nobody has shared where they are, so every distance pill is disabled
    // and says why — rather than silently returning everything.
    renderPage();
    const far = screen
      .getAllByTestId("ghad-choice")
      .filter((b) => b.dataset.row === "distance");
    expect(far.length).toBeGreaterThan(0);
    for (const pill of far) {
      expect(pill).toBeDisabled();
      expect(pill.title).toContain("Share where you are");
    }
  });

  it("leads with the verb somebody picked, and keeps the rest of the page", () => {
    render(
      <DiscoveryListView
        experiences={[
          candidate({
            id: "lake",
            name: "Otter Lake Park",
            knowledge: {
              affordances: [{ name: "swimming", basis: "stated-activity" }],
            },
          }),
          candidate({
            id: "rail",
            name: "Okanagan Rail Trail",
            knowledge: {
              affordances: [{ name: "cycling", basis: "stated-activity" }],
            },
          }),
        ].map(candidateToExperience)}
        displayName={null}
        now={NOW}
        today="Saturday, October 10"
      />,
    );
    const swimming = screen
      .getAllByTestId("ghad-choice")
      .find((b) => b.textContent?.startsWith("swimming"))!;
    fireEvent.click(swimming);
    const headings = screen
      .getAllByTestId("discovery-section")
      .map((s) => s.querySelector("h2")?.textContent ?? "");
    expect(headings[0]).toMatch(/swimming/i);
    // Refines, never replaces: the composed page is still underneath it.
    expect(headings.length).toBeGreaterThan(1);
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
  it("offers no mode switcher at all", () => {
    renderPage();
    // Map and AI were greyed-out peers for months; AI as a tab contradicts
    // the doctrine outright. Inspiration went the same way — the doctrine
    // fences it off from implementation, so advertising it as a tab promised
    // a product that does not exist. And Passport's own bar already says
    // "Discover", so a tab underneath saying the same word asked somebody to
    // tell two identically-named things apart.
    expect(screen.queryByTestId("mode-discover")).toBeNull();
    expect(screen.queryByTestId("mode-inspiration")).toBeNull();
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
    search = new URLSearchParams("intent=eat");
    renderPage();
    expect(screen.getAllByTestId("possibility").length).toBeGreaterThan(0);
  });

  it("leads with what has a picture when nothing was typed", () => {
    // Without a query there is nothing to rank by, so the pool arrived in
    // Atlas's order and the weakest card led. Arriving with the intent already
    // in the URL is also how the homepage's five doors land here.
    search = new URLSearchParams("intent=eat");
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
    const first = screen.getAllByTestId("possibility")[0]!;
    expect(first.dataset.hasImage).toBe("true");
  });

  it("narrows the whole page to one intent, across kind", () => {
    // A winery is an Organization; a park is a Place. Intent cuts across both.
    search = new URLSearchParams("intent=eat");
    renderPage();
    expect(screen.getByText("A winery")).toBeTruthy();
    expect(screen.queryByText("Kalamoir Park")).toBeNull();
  });

  it("is a place, not a mood — the intent lives in the URL", () => {
    // So the back button leaves it, a link can arrive already in it, and the
    // homepage's category tiles are real doors rather than the dead `<div>`s
    // they were. There is no longer a chip on Discovery that sets this — the
    // URL is the whole mechanism, which is exactly why it has to keep working.
    search = new URLSearchParams("intent=eat");
    renderPage();
    // Said in the intent's own words, so the page is not quietly narrowed.
    expect(screen.getByTestId("result-summary")).toHaveTextContent(
      "in Eat & drink",
    );
  });

  it("ignores an intent it does not recognise rather than guessing", () => {
    search = new URLSearchParams("intent=teleportation");
    renderPage();
    expect(screen.getAllByTestId("discovery-section").length).toBeGreaterThan(
      1,
    );
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

/**
 * **A distant possibility must not pass as a local one.**
 *
 * Canyon Frights led *Happening today* with no town at all, beside Okanagan
 * cards that said "· Kelowna" — so the bare card read as local by omission,
 * and it is 273 km away at Capilano Suspension Bridge Park.
 */
describe("geography on the card", () => {
  const geo = (over: Record<string, unknown>) => over as never;

  const placed = [
    candidate({
      id: "local",
      kind: "Event",
      name: "Apple Harvest Fest",
      subtype: "festival",
      startTime: "2026-10-10T00:00:00.000Z",
      endTime: "2026-10-10T00:00:00.000Z",
      timePrecision: "day",
      geography: geo({
        state: "observed",
        locality: "Vernon",
        localityBasis: "observed",
        area: { id: "okanagan", name: "Okanagan" },
      }),
    }),
    ...Array.from({ length: 6 }, (_, i) =>
      candidate({
        id: `okanagan-${i}`,
        name: `An Okanagan park ${i}`,
        subtype: "park",
        geography: geo({
          state: "observed",
          locality: "Kelowna",
          area: { id: "okanagan", name: "Okanagan" },
        }),
      }),
    ),
    candidate({
      id: "far",
      kind: "Event",
      name: "Canyon Frights",
      subtype: "seasonal event",
      startTime: "2026-10-10T00:00:00.000Z",
      endTime: "2026-10-10T00:00:00.000Z",
      timePrecision: "day",
      geography: geo({
        state: "derived",
        locality: "North Vancouver",
        localityBasis: "derived",
        area: { id: "metro-vancouver", name: "Metro Vancouver" },
      }),
    }),
    candidate({
      id: "nowhere",
      kind: "Event",
      name: "Don-O-Ray's Haunted Farm Adventure",
      subtype: "seasonal event",
      startTime: "2026-10-10T00:00:00.000Z",
      endTime: "2026-10-10T00:00:00.000Z",
      timePrecision: "day",
      geography: geo({ state: "unknown" }),
    }),
  ].map(candidateToExperience);

  const renderPlaced = () =>
    render(
      <DiscoveryListView
        experiences={placed}
        displayName={null}
        now={NOW}
        today="Saturday, October 10"
      />,
    );

  const cardFor = (title: string) =>
    screen
      .getAllByTestId("possibility")
      .find((c) => c.textContent?.includes(title))!;

  it("marks the one that is somewhere else", () => {
    renderPlaced();
    expect(
      within(cardFor("Canyon Frights")).getByTestId("possibility-area"),
    ).toHaveTextContent("Metro Vancouver");
  });

  it("leaves the local ones unmarked rather than labelling everything", () => {
    renderPlaced();
    expect(
      within(cardFor("Apple Harvest Fest")).queryByTestId("possibility-area"),
    ).toBeNull();
  });

  it("names the town on both, so neither is bare", () => {
    renderPlaced();
    expect(cardFor("Canyon Frights")).toHaveTextContent("North Vancouver");
    expect(cardFor("Apple Harvest Fest")).toHaveTextContent("Vernon");
  });

  it("says nothing about a place Atlas does not know", () => {
    renderPlaced();
    const card = cardFor("Don-O-Ray");
    expect(within(card).queryByTestId("possibility-area")).toBeNull();
    expect(card).not.toHaveTextContent(/Vernon|Vancouver|Kelowna/);
  });

  it("prints no implementation language anywhere on the page", () => {
    renderPlaced();
    const page = document.body.textContent ?? "";
    for (const word of [
      "derived",
      "observed",
      "candidate-geography",
      "happens_at",
      "localityBasis",
    ]) {
      expect(page).not.toContain(word);
    }
  });
});
