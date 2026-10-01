import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CATALOGUE } from "@/lib/movies/catalogue";
import type { OctoberThing } from "@/lib/october/types";
import { keepableFilm } from "./movies/keepableFilm";

/**
 * **A film in My October, beside the real-world things.**
 *
 * A movie is a first-class October thing, not a second kind of record — it
 * sits in the same table, in the same two lanes, and becomes Lived the same
 * way a pumpkin patch does. What it must *not* do is borrow the language of
 * the things that have dates: a film has no day until somebody plans one, and
 * Anticipate's whole discipline is that nothing invents one.
 */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }),
  usePathname: () => "/october/mine",
}));
const didThis = vi.fn(async (id: string) => ({ entityId: id }));
const forget = vi.fn<(id: string) => Promise<void>>(async () => {});
vi.mock("@/lib/october/october-repo", () => ({
  didThis: (id: string) => didThis(id),
  forget: (id: string) => forget(id),
}));
const saveReaction = vi.fn(
  async (filmId: string, r: { verdict: string; felt?: string }) => ({
    filmId,
    verdict: r.verdict,
    felt: r.felt ?? null,
    gotMe: null,
    reactedAt: "2026-10-12T04:00:00.000Z",
  }),
);
vi.mock("@/lib/movies/movies-repo", () => ({
  saveReaction: (filmId: string, r: { verdict: string; felt?: string }) =>
    saveReaction(filmId, r),
}));

const { MyOctober } = await import("./MyOctober");

/** A real film, kept exactly the way both movie flows keep one. */
const FILM = CATALOGUE.find((f) => f.id === "great-pumpkin")!;

const savedFilm = (over: Partial<OctoberThing> = {}): OctoberThing => ({
  entityId: FILM.id,
  entityKind: "Movie",
  name: keepableFilm(FILM).name,
  startsAt: null,
  state: "ahead",
  wantedAt: "2026-09-20T10:00:00.000Z",
  livedAt: null,
  ...over,
});

const OCT_9 = new Date("2026-10-09T19:00:00.000Z");

beforeEach(() => {
  didThis.mockClear();
  forget.mockClear();
  saveReaction.mockClear();
});

describe("a saved film in Ahead", () => {
  it("appears in My October by name", () => {
    render(<MyOctober things={[savedFilm()]} experiences={[]} now={OCT_9} />);
    expect(screen.getByText(keepableFilm(FILM).name)).toBeInTheDocument();
    expect(screen.getAllByTestId("ahead-thing")).toHaveLength(1);
  });

  it("is given no temporal language, because it has no date", () => {
    render(<MyOctober things={[savedFilm()]} experiences={[]} now={OCT_9} />);
    // The urgency signal is absent entirely — not "Tonight", not "Passed",
    // not a soft guess from when it was saved.
    expect(screen.queryByTestId("nearness")).not.toBeInTheDocument();
    const row = screen.getByTestId("ahead-thing");
    expect(row).toHaveAttribute("data-nearness", "unknown");
  });

  it("says what it is, so the row is not an untitled nothing", () => {
    render(<MyOctober things={[savedFilm()]} experiences={[]} now={OCT_9} />);
    expect(screen.getByTestId("thing-kind")).toHaveTextContent("Film");
  });

  it("opens its page in the catalogue", () => {
    render(<MyOctober things={[savedFilm()]} experiences={[]} now={OCT_9} />);
    expect(
      screen.getByRole("link", { name: keepableFilm(FILM).name }),
    ).toHaveAttribute("href", `/october/movies/${FILM.id}`);
  });

  it("gets no link when the catalogue no longer holds it", () => {
    render(
      <MyOctober
        things={[savedFilm({ entityId: "a-film-since-removed" })]}
        experiences={[]}
        now={OCT_9}
      />,
    );
    // A dead link to a 404 is worse than a row that simply does not open.
    expect(
      screen.queryByRole("link", { name: keepableFilm(FILM).name }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(keepableFilm(FILM).name)).toBeInTheDocument();
  });

  it("sorts below dated things without being pushed past them", () => {
    const dated: OctoberThing = {
      entityId: "evt",
      entityKind: "Event",
      name: "Something on tonight",
      startsAt: "2026-10-09T19:00:00.000Z",
      state: "ahead",
      wantedAt: "2026-09-01T10:00:00.000Z",
      livedAt: null,
    };
    render(
      <MyOctober things={[savedFilm(), dated]} experiences={[]} now={OCT_9} />,
    );
    const rows = screen.getAllByTestId("ahead-thing");
    expect(rows[0]).toHaveTextContent("Something on tonight");
    expect(rows[1]).toHaveTextContent(keepableFilm(FILM).name);
  });
});

describe("watching it", () => {
  it("becomes Lived through the same control everything else uses", async () => {
    render(<MyOctober things={[savedFilm()]} experiences={[]} now={OCT_9} />);
    fireEvent.click(screen.getByRole("button", { name: /did this/i }));
    await waitFor(() => expect(didThis).toHaveBeenCalledWith(FILM.id));
  });

  it("moves into Lived and offers the reaction there", () => {
    render(
      <MyOctober
        things={[
          savedFilm({ state: "lived", livedAt: "2026-10-11T04:00:00.000Z" }),
        ]}
        experiences={[]}
        now={OCT_9}
      />,
    );
    expect(screen.getByTestId("lived-thing")).toBeInTheDocument();
    expect(screen.queryAllByTestId("ahead-thing")).toHaveLength(0);
    // FilmReaction is reachable — this is the existing reaction system, not
    // a second one built for the browse surface.
    expect(screen.getByTestId("verdict")).toBeInTheDocument();
    expect(screen.getByTestId("verdict-loved")).toBeInTheDocument();
  });

  it("persists a reaction through the existing movies repo", async () => {
    render(
      <MyOctober
        things={[
          savedFilm({ state: "lived", livedAt: "2026-10-11T04:00:00.000Z" }),
        ]}
        experiences={[]}
        now={OCT_9}
      />,
    );
    // The real two-step: how was it, then how frightening it actually was.
    fireEvent.click(screen.getByTestId("verdict-good"));
    fireEvent.click(screen.getByTestId("felt-cozy"));
    await waitFor(() => expect(saveReaction).toHaveBeenCalled());
    expect(saveReaction.mock.calls[0]![0]).toBe(FILM.id);
    expect(saveReaction.mock.calls[0]![1]).toMatchObject({
      verdict: "good",
      felt: "cozy",
    });
  });

  it("shows a reaction it already has", () => {
    render(
      <MyOctober
        things={[
          savedFilm({ state: "lived", livedAt: "2026-10-11T04:00:00.000Z" }),
        ]}
        experiences={[]}
        now={OCT_9}
        reactions={[
          {
            filmId: FILM.id,
            verdict: "loved",
            felt: "cozy",
            gotMe: null,
            reactedAt: "2026-10-11T05:00:00.000Z",
          },
        ]}
      />,
    );
    expect(screen.getByTestId("film-reaction")).toHaveTextContent("Loved it");
    expect(screen.getByTestId("film-reaction")).toHaveTextContent("cozy");
  });

  it("stays Lived — nothing about a film can undo that", () => {
    render(
      <MyOctober
        things={[
          savedFilm({ state: "lived", livedAt: "2026-10-11T04:00:00.000Z" }),
        ]}
        experiences={[]}
        now={new Date("2026-11-20T19:00:00.000Z")}
      />,
    );
    expect(screen.getByTestId("lived-thing")).toBeInTheDocument();
    expect(screen.queryByTestId("nearness")).not.toBeInTheDocument();
  });
});

describe("beside real-world things", () => {
  it("never becomes Lived on its own, however long it sits there", () => {
    render(
      <MyOctober
        things={[savedFilm()]}
        experiences={[]}
        now={new Date("2026-12-25T19:00:00.000Z")}
      />,
    );
    // Months later and still Ahead: only a person says they watched it.
    expect(screen.getByTestId("ahead-thing")).toBeInTheDocument();
    expect(screen.queryAllByTestId("lived-thing")).toHaveLength(0);
    expect(didThis).not.toHaveBeenCalled();
  });
});
