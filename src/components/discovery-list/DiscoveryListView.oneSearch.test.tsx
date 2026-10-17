import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import type { DiscoveryCandidate } from "@/lib/data/types";

/**
 * **One search, one conversation.**
 *
 * Discovery had two text boxes — a sentence at the top and a name search
 * above the results — with two states behind them. These pin what replaced
 * them: one box, whose follow-ups keep what was already said, whose answer
 * finds places by name, and whose conversation the editorial sections under
 * it listen to rather than ignore.
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
  saveExperienceToBoard: async () => ({}),
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

const place = (
  name: string,
  over: Partial<DiscoveryCandidate> = {},
): DiscoveryCandidate => ({
  id: name.toLowerCase().replace(/\W+/g, "-"),
  kind: "Place",
  name,
  description: "A description long enough to be real, about this place.",
  subtype: "park",
  mediaCount: 0,
  containsCount: 0,
  regionIds: [],
  geography: {
    state: "observed",
    locality: "Vernon",
    area: { id: "okanagan", name: "Okanagan" },
  },
  ...over,
});
const exposure = (value: "indoor" | "outdoor") => ({
  environment: {
    setting: "unknown" as const,
    rain: { reading: "unknown" as const, basis: "none" as const },
    exposure: { value, basis: "derived" as const },
  },
});

const pool = [
  place("Museum of Vernon", { subtype: "museum", ...exposure("indoor") }),
  place("Open Meadow", exposure("outdoor")),
  place("Davison Orchards", { subtype: "orchard" }),
  place("Bean Scene Cafe", { subtype: "cafe", ...exposure("indoor") }),
  place("Harvest Supper", { kind: "Organization", subtype: "restaurant" }),
].map(candidateToExperience);

const fakeServer = vi.fn(
  async () => new Response(JSON.stringify({ by: "words", ask: {} })),
);

const renderPage = () => {
  const page = () => (
    <DiscoveryListView
      experiences={pool}
      displayName={null}
      now="2026-10-11T18:00:00.000Z"
      today="Sunday, October 11"
    />
  );
  const view = render(page());
  rerenders.push(() => view.rerender(page()));
  return view;
};

const say = async (said: string) => {
  fireEvent.change(screen.getByTestId("ask-input"), {
    target: { value: said },
  });
  await act(async () => {
    fireEvent.click(screen.getByTestId("ask-submit"));
  });
};
const pressed = (row: string) =>
  screen
    .getAllByTestId("ghad-choice")
    .filter(
      (b) => b.dataset.row === row && b.getAttribute("aria-pressed") === "true",
    )
    .map((b) => b.textContent);
const inSections = () =>
  screen.queryAllByTestId("discovery-section").flatMap((s) =>
    within(s)
      .queryAllByTestId("possibility")
      .map((c) => c.textContent ?? ""),
  );
const sectionsHave = (name: string) =>
  inSections().some((text) => text.includes(name));
const said = () => new URLSearchParams(window.location.search).getAll("ask");

beforeEach(() => {
  vi.clearAllMocks();
  search = new URLSearchParams();
  rerenders.length = 0;
  window.history.replaceState(null, "", "/discovery");
  vi.stubGlobal("fetch", fakeServer);
});

describe("one search", () => {
  it("has one text box and one search landmark", () => {
    renderPage();
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.getAllByRole("search")).toHaveLength(1);
    expect(screen.getByTestId("ask-input")).toBeInTheDocument();
  });

  it("finds a place by name in that box", async () => {
    renderPage();
    await say("Davison Orchards");
    expect(screen.getByTestId("ask-heading")).toHaveTextContent(
      "Davison Orchards",
    );
  });

  it("keeps browsing by kind, under Refine", async () => {
    renderPage();
    fireEvent.click(screen.getByTestId("ghad-refine"));
    expect(
      screen
        .getAllByTestId("ghad-choice")
        .filter((b) => b.dataset.row === "kind").length,
    ).toBeGreaterThan(0);
  });

  it("puts the October door on the summary line, not on a row of its own", () => {
    renderPage();
    expect(
      within(screen.getByTestId("answer-summary")).getByTestId("october-door"),
    ).toHaveAttribute("href", "/october");
  });
});

describe("one conversation", () => {
  it("keeps what was said earlier as each follow-up arrives", async () => {
    renderPage();
    await say("Something fun with my daughter.");
    expect(pressed("company")).toEqual(["a young child"]);
    await say("Somewhere indoors.");
    await say("Within 30 minutes.");
    await say("Actually, somewhere we can eat too.");
    // Nobody repeated themselves, and nothing was dropped.
    expect(said()).toEqual([
      "Something fun with my daughter.",
      "Somewhere indoors.",
      "Within 30 minutes.",
      "Actually, somewhere we can eat too.",
    ]);
    expect(pressed("company")).toEqual(["a young child"]);
    expect(screen.getAllByTestId("ask-turn")).toHaveLength(4);
    // All four said back: who, the sky, the drive and the food.
    const heard = screen.getByTestId("ask-understood");
    expect(heard).toHaveTextContent("with a kid");
    expect(heard).toHaveTextContent("staying dry");
    expect(heard).toHaveTextContent("up to 30 min away");
    expect(heard).toHaveTextContent("eat & drink");
  });

  it("the sections under the answer listen to it, and come back when it is cleared", async () => {
    renderPage();
    expect(sectionsHave("Open Meadow")).toBe(true);
    await say("Somewhere indoors.");
    expect(sectionsHave("Open Meadow")).toBe(false);
    expect(sectionsHave("Museum of Vernon")).toBe(true);
    fireEvent.click(screen.getByTestId("ask-clear"));
    expect(said()).toEqual([]);
    expect(sectionsHave("Open Meadow")).toBe(true);
  });

  it("changing a constraint replaces it rather than adding a second", async () => {
    renderPage();
    await say("Somewhere indoors.");
    expect(sectionsHave("Open Meadow")).toBe(false);
    await say("Actually, let's get outside.");
    expect(sectionsHave("Open Meadow")).toBe(true);
    expect(sectionsHave("Museum of Vernon")).toBe(false);
  });

  it("answers without the model: the words alone are enough", async () => {
    // The route answers `by: "words"` when no key is configured; nothing on
    // the page waits on it or changes because of it.
    renderPage();
    await say("Something fun with my daughter.");
    expect(screen.getByTestId("ask-answer")).toBeInTheDocument();
    expect(fakeServer).toHaveBeenCalledWith(
      "/api/discovery/ask",
      expect.anything(),
    );
  });
});
