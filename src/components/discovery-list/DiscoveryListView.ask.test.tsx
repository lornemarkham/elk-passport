import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { distanceKm } from "@/lib/environment/geo";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import type { DiscoveryCandidate } from "@/lib/data/types";
import { placeById } from "@/domain/environment/places";

/**
 * **Asking Discovery a question in your own words.**
 *
 * End to end through the page: a sentence sets the same rows a tap would,
 * an answer appears with a reason for every pick, the question lives in the
 * URL, and every pick is one tap from *Go have a day* — carrying the town,
 * the age and the day, and never a coordinate.
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

const VERNON = placeById("vernon")!;

const near = (
  name: string,
  km: number,
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
    coordinates: [VERNON.longitude, VERNON.latitude + km / 111],
  },
  ...over,
});
const doing = (...names: string[]) => ({
  knowledge: {
    affordances: names.map((name) => ({ name, basis: "stated-activity" })),
  },
});

const pool = [
  near("Polson Park", 1, doing("Playground", "Picnic areas")),
  near("Kal Beach", 6, { subtype: "beach", ...doing("Swimming") }),
  near("Ridge Llamas", 9, {
    subtype: "llama farm",
    ...doing("Llama trekking"),
  }),
  near("Sovereign Lake", 55, {
    subtype: "nordic centre",
    containsCount: 3,
    ...doing("Skiing", "Snowshoeing", "Hiking"),
  }),
].map(candidateToExperience);

/** Atlas's distance reading, and the ask route answering without a key. */
const asked: string[] = [];
const fakeServer = vi.fn(async (url: string, init?: RequestInit) => {
  asked.push(url);
  const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
  if (url === "/api/discovery/ask") {
    return new Response(JSON.stringify({ by: "words", ask: {} }));
  }
  const origin = {
    latitude: body.latitude as number,
    longitude: body.longitude as number,
  };
  const distances: Record<string, unknown> = {};
  for (const experience of pool) {
    const c = experience.geography!.coordinates!;
    const km = distanceKm(origin, { latitude: c[1], longitude: c[0] });
    distances[experience.id] = {
      state: "measured",
      km,
      basis: "coordinates",
      within: km <= (body.withinKm as number),
    };
  }
  return new Response(JSON.stringify({ withinKm: body.withinKm, distances }));
});

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

const ask = async (said: string) => {
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

beforeEach(() => {
  vi.clearAllMocks();
  search = new URLSearchParams();
  rerenders.length = 0;
  asked.length = 0;
  window.history.replaceState(null, "", "/discovery");
  vi.stubGlobal("fetch", fakeServer);
});

describe("asking Discovery a question", () => {
  it("offers the four questions as doors before anybody types", () => {
    renderPage();
    expect(
      screen.getAllByTestId("ask-example").map((b) => b.textContent),
    ).toEqual([
      "What can we do with three hours?",
      "What's something unusual nearby?",
      "Where can I take my kid this afternoon?",
      "What is worth driving an hour for?",
    ]);
  });

  it("keeps the rows behind one line on a phone, and says what is already chosen", async () => {
    renderPage();
    const refine = screen.getByTestId("ghad-refine");
    expect(refine).toHaveAttribute("aria-expanded", "false");
    expect(refine).toHaveTextContent("Narrow it down");
    expect(document.getElementById("ghad-rows")).toHaveClass("hidden");
    await ask("three hours");
    // What the sentence set is what the line says — nothing needs opening.
    expect(refine).toHaveTextContent("half a day");
    fireEvent.click(refine);
    expect(refine).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById("ghad-rows")).not.toHaveClass("hidden");
  });

  it("says so when it could read nothing from the sentence, and offers no 'Heard:' it did not hear", async () => {
    renderPage();
    await ask("take me to Atlantis");
    expect(screen.getByTestId("ask-heading")).toHaveTextContent(
      "I didn't catch what you're after",
    );
    expect(screen.getByTestId("ask-unread")).toHaveTextContent(
      /Atlas knows about/,
    );
    expect(screen.queryByTestId("ask-understood")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ask-note")).not.toBeInTheDocument();
  });

  it("sets the same rows a tap would, and says what it heard", async () => {
    renderPage();
    await act(async () => {
      fireEvent.click(
        screen.getByText("Where can I take my kid this afternoon?"),
      );
    });
    expect(pressed("company")).toEqual(["a young child"]);
    expect(pressed("time")).toEqual(["half a day"]);
    expect(pressed("when")).toEqual(["today"]);
    expect(screen.getByTestId("ask-heading")).toHaveTextContent(
      "Somewhere to take a kid this afternoon",
    );
    expect(screen.getByTestId("ask-understood")).toHaveTextContent(
      "with a kid",
    );
    // No age was said, so none is chosen — it is asked for instead.
    expect(screen.getByTestId("ask-gap-age")).toBeInTheDocument();
    expect(pressed("company")).not.toContain("age 5");
  });

  it("gives each pick its reason, and leads with what a child can do", async () => {
    renderPage();
    await ask("Where can I take my kid this afternoon?");
    const answer = screen.getByTestId("ask-answer");
    const cards = within(answer).getAllByTestId("possibility");
    expect(cards[0]).toHaveTextContent("Polson Park");
    expect(
      within(cards[0]!).getByTestId("possibility-because"),
    ).toHaveTextContent("Playground · Picnic areas, as listed");
  });

  it("keeps the question in the URL, so a refresh brings the answer back", async () => {
    renderPage();
    await ask("something unusual");
    expect(new URLSearchParams(window.location.search).get("ask")).toBe(
      "something unusual",
    );
  });

  it("asks the server to read it too — in a body, never a URL", async () => {
    renderPage();
    await ask("tire out the twins");
    const call = fakeServer.mock.calls.find(
      ([url]) => url === "/api/discovery/ask",
    );
    expect(call?.[1]?.method).toBe("POST");
    expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({
      said: "tire out the twins",
      today: "2026-10-11",
    });
  });

  it("answers 'worth the drive' only past the line it states", async () => {
    renderPage();
    fireEvent.change(screen.getByTestId("ghad-town"), {
      target: { value: "vernon" },
    });
    await ask("What is worth driving an hour for?");
    await waitFor(() =>
      expect(
        within(screen.getByTestId("ask-answer")).getAllByTestId(
          "possibility",
        )[0],
      ).toHaveTextContent("Sovereign Lake"),
    );
    const answer = screen.getByTestId("ask-answer");
    expect(within(answer).queryByText("Polson Park")).toBeNull();
    expect(screen.getByTestId("ask-note")).toHaveTextContent(
      "can't time a drive",
    );
  });

  it("asks 'from where?' with the answer to it right there, and measures once it has one", async () => {
    renderPage();
    await ask("What is worth driving an hour for?");
    const gap = screen.getByTestId("ask-gap-origin");
    // The question and its two honest answers are the same element.
    expect(within(gap).getByTestId("ask-town")).toBeInTheDocument();
    fireEvent.change(within(gap).getByTestId("ask-town"), {
      target: { value: "vernon" },
    });
    await waitFor(() =>
      expect(screen.queryByTestId("ask-gap-origin")).toBeNull(),
    );
    expect(screen.getByTestId("ask-understood")).toHaveTextContent(
      "an hour each way",
    );
    await waitFor(() =>
      expect(
        within(screen.getByTestId("ask-answer")).getAllByTestId(
          "possibility",
        )[0],
      ).toHaveTextContent("Sovereign Lake"),
    );
    expect(screen.getByTestId("ask-heading")).toHaveTextContent(
      "Worth an hour of driving",
    );
  });

  it("hands a pick to Go have a day with the town and the sentence, never a coordinate", async () => {
    renderPage();
    fireEvent.change(screen.getByTestId("ghad-town"), {
      target: { value: "vernon" },
    });
    await ask("something unusual");
    await waitFor(() =>
      expect(screen.getByTestId("ask-answer")).toBeInTheDocument(),
    );
    const link = within(screen.getByTestId("ask-answer")).getAllByTestId(
      "plan-a-day",
    )[0]!;
    const href = new URL(link.getAttribute("href")!, "https://passport.test");
    expect(href.pathname).toBe("/go");
    expect(href.searchParams.get("say")).toBe("something unusual");
    expect(href.searchParams.get("at")).toBe("vernon");
    expect(href.searchParams.get("with")).toBeTruthy();
    expect(href.search).not.toMatch(/\d+\.\d{2,}/);
    expect(screen.getByTestId("ask-make-a-day")).toHaveAttribute(
      "href",
      expect.stringContaining("/go?"),
    );
  });

  it("puts every card on the page one tap from a day, not only the answer's", () => {
    renderPage();
    const cards = screen.getAllByTestId("possibility");
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards)
      expect(within(card).getByTestId("plan-a-day")).toHaveAttribute(
        "href",
        expect.stringContaining("say=Half+a+day"),
      );
  });

  it("clears the question and leaves the answers as they were", async () => {
    renderPage();
    await ask("three hours");
    expect(pressed("time")).toEqual(["half a day"]);
    fireEvent.click(screen.getByTestId("ask-clear"));
    expect(screen.queryByTestId("ask-answer")).toBeNull();
    expect(pressed("time")).toEqual(["half a day"]);
    expect(new URLSearchParams(window.location.search).get("ask")).toBeNull();
  });
});
