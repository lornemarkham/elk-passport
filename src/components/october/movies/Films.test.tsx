import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { CATALOGUE, suitableFor } from "@/lib/movies/catalogue";
import { ANGLE_ORDER, angleOf, filmsOnShelf } from "@/lib/movies/editorial";
import { forgetEverythingKept } from "@/components/october/save/keeping";
import { keepableFilm } from "./keepableFilm";
import { Films } from "./Films";

/**
 * **The ordinary movie experience: browse it, keep it, and be told the truth.**
 *
 * Movie Night could already keep a film. What it could not do was let anybody
 * *look* at the catalogue — three of twenty-eight films, chosen by a funnel.
 * These prove the other half works, and that it did not grow a second way to
 * save anything while doing it.
 *
 * `fetch` is intercepted, so the route named below is the real one:
 * `/api/october/things/{id}` — the same row `/october/mine` reads and the same
 * one `wantToDo` writes from Movie Night.
 */
let calls: { url: string; method: string; body: unknown }[] = [];

function answerWith(status: number) {
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: typeof input === "string" ? input : input.toString(),
      method: init?.method ?? "GET",
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    return Promise.resolve(
      new Response(status === 204 ? null : JSON.stringify({}), { status }),
    );
  });
}

beforeEach(() => {
  calls = [];
  forgetEverythingKept();
  answerWith(200);
});

afterEach(() => {
  vi.unstubAllGlobals();
  forgetEverythingKept();
});

const signedIn = { kept: new Set<string>(), signedIn: true };

describe("browsing the catalogue", () => {
  it("renders the whole catalogue, not a shortlist", () => {
    render(<Films {...signedIn} />);
    expect(screen.getAllByTestId("film-card")).toHaveLength(CATALOGUE.length);
    expect(screen.getByTestId("film-count")).toHaveTextContent(
      `${CATALOGUE.length} films`,
    );
  });

  it("gives every card its authored reason and its three facts", () => {
    render(<Films {...signedIn} />);
    const first = CATALOGUE[0]!;
    const card = screen
      .getAllByTestId("film-card")
      .find((c) => c.dataset.filmId === first.id)!;
    expect(card).toHaveTextContent(first.line);
    expect(within(card).getByTestId("film-facts").children).toHaveLength(3);
  });

  it("narrows by audience using the catalogue's own ceiling rule", () => {
    render(<Films {...signedIn} />);
    fireEvent.click(screen.getByRole("button", { name: "Kids" }));
    // `suitableFor("kids")` is every film a child may watch, which is more
    // than the films authored `kids`.
    expect(screen.getAllByTestId("film-card")).toHaveLength(
      suitableFor("kids").length,
    );
  });

  it("narrows by fear independently of audience", () => {
    render(<Films {...signedIn} />);
    fireEvent.click(screen.getByRole("button", { name: "Creepy" }));
    const shown = screen
      .getAllByTestId("film-card")
      .map((c) => c.dataset.filmId);
    for (const id of shown) {
      expect(CATALOGUE.find((f) => f.id === id)!.fear).toBe("creepy");
    }
  });

  it("says so honestly when a pairing has nothing in it", () => {
    render(<Films {...signedIn} />);
    fireEvent.click(screen.getByRole("button", { name: "Kids" }));
    fireEvent.click(screen.getByRole("button", { name: "Nightmare" }));
    expect(screen.getByTestId("films-empty")).toBeInTheDocument();
    expect(screen.queryAllByTestId("film-card")).toHaveLength(0);
  });

  it("clears a filter when its active option is pressed again", () => {
    render(<Films {...signedIn} />);
    const kids = screen.getByRole("button", { name: "Kids" });
    fireEvent.click(kids);
    expect(screen.getAllByTestId("film-card").length).toBeLessThan(
      CATALOGUE.length,
    );
    fireEvent.click(kids);
    expect(screen.getAllByTestId("film-card")).toHaveLength(CATALOGUE.length);
  });
});

describe("keeping a film from the catalogue", () => {
  it("saves through the same route everything else in October uses", async () => {
    const film = CATALOGUE[0]!;
    render(<Films {...signedIn} />);
    const card = screen
      .getAllByTestId("film-card")
      .find((c) => c.dataset.filmId === film.id)!;

    fireEvent.click(within(card).getByTestId("keep-on-card"));

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]!.url).toBe(`/api/october/things/${film.id}`);
    expect(calls[0]!.method).toBe("PUT");
  });

  it("writes exactly the row Movie Night writes", async () => {
    const film = CATALOGUE[0]!;
    render(<Films {...signedIn} />);
    const card = screen
      .getAllByTestId("film-card")
      .find((c) => c.dataset.filmId === film.id)!;

    fireEvent.click(within(card).getByTestId("keep-on-card"));
    await waitFor(() => expect(calls).toHaveLength(1));

    // The shape both flows derive from one function, so the two can never
    // disagree about a film's name and silently rewrite each other's row.
    const expected = keepableFilm(film);
    expect(calls[0]!.body).toEqual({
      entityKind: "Movie",
      name: expected.name,
      startsAt: null,
    });
    expect(expected.name).toBe(`${film.title} (${film.year})`);
  });

  it("never sends a date for a film", async () => {
    render(<Films {...signedIn} />);
    fireEvent.click(screen.getAllByTestId("keep-on-card")[0]!);
    await waitFor(() => expect(calls).toHaveLength(1));
    expect((calls[0]!.body as { startsAt: unknown }).startsAt).toBeNull();
  });

  it("renders an already-kept film as kept on the first painted frame", () => {
    const film = CATALOGUE[0]!;
    render(<Films kept={new Set([film.id])} signedIn />);
    const card = screen
      .getAllByTestId("film-card")
      .find((c) => c.dataset.filmId === film.id)!;
    expect(within(card).getByTestId("keep-on-card")).toHaveAttribute(
      "data-saved",
      "true",
    );
    expect(within(card).getByTestId("keep-kept-label")).toBeInTheDocument();
    // Nothing was asked of the server to find that out.
    expect(calls).toHaveLength(0);
  });

  it("asks the server once per press, never once per card", async () => {
    render(<Films {...signedIn} />);
    // Twenty-eight cards rendered, and not a single request among them.
    expect(calls).toHaveLength(0);
    fireEvent.click(screen.getAllByTestId("keep-on-card")[0]!);
    await waitFor(() => expect(calls).toHaveLength(1));
  });

  it("says a failed save failed, and stays unkept", async () => {
    answerWith(500);
    render(<Films {...signedIn} />);
    const control = screen.getAllByTestId("keep-on-card")[0]!;
    fireEvent.click(control);
    await waitFor(() =>
      expect(screen.getAllByTestId("keep-failed").length).toBeGreaterThan(0),
    );
    expect(control).toHaveAttribute("data-saved", "false");
  });
});

describe("signed out", () => {
  it("offers a sign-in rather than a control that does nothing", () => {
    render(<Films kept={new Set()} signedIn={false} />);
    expect(screen.queryAllByTestId("keep-on-card")).toHaveLength(0);
    const invite = screen.getAllByTestId("keep-signed-out")[0]!;
    expect(invite).toHaveAttribute(
      "href",
      `/auth?next=${encodeURIComponent("/october/movies")}`,
    );
  });

  it("still shows the whole catalogue — reading needs no account", () => {
    render(<Films kept={new Set()} signedIn={false} />);
    expect(screen.getAllByTestId("film-card")).toHaveLength(CATALOGUE.length);
  });

  it("never claims a film is kept for somebody with nowhere to keep it", () => {
    render(<Films kept={new Set()} signedIn={false} />);
    expect(screen.queryAllByTestId("keep-kept-label")).toHaveLength(0);
  });
});

describe("Movie Night stays reachable", () => {
  it("links to the guided version rather than replacing it", () => {
    render(<Films {...signedIn} />);
    expect(screen.getByRole("link", { name: /Can't decide/ })).toHaveAttribute(
      "href",
      "/october/movies/night",
    );
  });
});

describe("edited shelves, not a search result", () => {
  it("groups the catalogue under October's own angles", () => {
    render(<Films {...signedIn} />);
    const shelves = screen.getAllByTestId("shelf");
    expect(shelves.length).toBeGreaterThan(1);
    // Every shelf rendered is one the voice table knows.
    for (const shelf of shelves) {
      expect(ANGLE_ORDER).toContain(shelf.dataset.angle);
    }
  });

  it("leads with the strange shelf rather than the canon", () => {
    render(<Films {...signedIn} />);
    const shelves = screen.getAllByTestId("shelf");
    expect(shelves[0]!.dataset.angle).toBe("what-the-hell");
  });

  it("puts each film on exactly one shelf", () => {
    render(<Films {...signedIn} />);
    const onShelves = screen
      .getAllByTestId("shelf")
      .flatMap((s) =>
        [...s.querySelectorAll("[data-testid=film-card]")].map(
          (c) => (c as HTMLElement).dataset.filmId,
        ),
      );
    expect(onShelves).toHaveLength(CATALOGUE.length);
    expect(new Set(onShelves).size).toBe(CATALOGUE.length);
  });

  it("collapses to one grid once somebody is narrowing", () => {
    render(<Films {...signedIn} />);
    fireEvent.click(screen.getByRole("button", { name: "Kids" }));
    // Editorial headings between four results would be decoration.
    expect(screen.queryAllByTestId("shelf")).toHaveLength(0);
    expect(screen.getByTestId("film-grid")).toBeInTheDocument();
  });

  it("gives every card October's reason for reaching for it", () => {
    render(<Films {...signedIn} />);
    expect(screen.getAllByTestId("film-angle")).toHaveLength(CATALOGUE.length);
  });

  it("names where a film is from, where that is worth saying", () => {
    render(<Films {...signedIn} />);
    const canadian = CATALOGUE.filter((f) => f.origin === "Canada")[0]!;
    const card = screen
      .getAllByTestId("film-card")
      .find((c) => c.dataset.filmId === canadian.id)!;
    expect(card).toHaveTextContent("Canada");
  });

  it("offers a trailer on the card, so the detail page is optional", () => {
    render(<Films {...signedIn} />);
    const playable = screen.queryAllByTestId("trailer-poster").length;
    const findable = screen.queryAllByTestId("trailer-search").length;
    expect(playable + findable).toBe(CATALOGUE.length);
  });
});

describe("a person's own reactions, and nobody else's", () => {
  const watched = CATALOGUE.find((f) => angleOf(f.id) === "what-the-hell")!;

  it("tells somebody what they already thought of a film", () => {
    render(
      <Films
        kept={new Set()}
        signedIn
        reactions={[[watched.id, "loved"] as const]}
      />,
    );
    const card = screen
      .getAllByTestId("film-card")
      .find((c) => c.dataset.filmId === watched.id)!;
    expect(within(card).getByTestId("you-said")).toHaveTextContent(
      "You loved this",
    );
  });

  it("says it only on the film they said it about", () => {
    render(
      <Films
        kept={new Set()}
        signedIn
        reactions={[[watched.id, "meh"] as const]}
      />,
    );
    expect(screen.getAllByTestId("you-said")).toHaveLength(1);
  });

  it("shows nothing where they have said nothing", () => {
    render(<Films {...signedIn} />);
    expect(screen.queryAllByTestId("you-said")).toHaveLength(0);
  });

  it("never implies anybody else has an opinion", () => {
    // passport_movie_reactions is private by row-level security. Until a
    // moderation model exists there is no community voice to render, and the
    // page must not invent the appearance of one.
    render(
      <Films
        kept={new Set()}
        signedIn
        reactions={[[watched.id, "loved"] as const]}
      />,
    );
    expect(screen.queryByText(/people (loved|said)/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+ reviews?/i)).not.toBeInTheDocument();
    expect(screen.getByTestId("you-said").textContent).toMatch(/^You /);
  });

  it("keeps the catalogue's shelves intact on every film", () => {
    // A reaction changes what a card says, never which shelf it is on.
    render(
      <Films
        kept={new Set()}
        signedIn
        reactions={[[watched.id, "meh"] as const]}
      />,
    );
    const shelf = screen
      .getAllByTestId("shelf")
      .find((s) => s.dataset.angle === "what-the-hell")!;
    expect(shelf.querySelectorAll("[data-testid=film-card]")).toHaveLength(
      filmsOnShelf("what-the-hell").length,
    );
  });
});
