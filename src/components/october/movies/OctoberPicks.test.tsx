import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { filmById } from "@/lib/movies/catalogue";
import { ANGLES, OCTOBER_PICKS, angleOf } from "@/lib/movies/editorial";
import { forgetEverythingKept } from "@/components/october/save/keeping";
import { keepableFilm } from "./keepableFilm";
import { OctoberPicks } from "./OctoberPicks";

/**
 * **The point of the picks: wanting a film without navigating to it.**
 *
 * The shape being proved is `HOOK → VISUAL → WHY OCTOBER PICKED IT → SAVE`,
 * all of it on `/october`. If any one of those four needs a click through to a
 * detail page, the section has failed at the only job it has.
 */
let calls: { url: string; method: string; body: unknown }[] = [];

beforeEach(() => {
  calls = [];
  forgetEverythingKept();
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: typeof input === "string" ? input : input.toString(),
      method: init?.method ?? "GET",
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  forgetEverythingKept();
});

const signedIn = { kept: new Set<string>(), signedIn: true };

describe("the four beats, all on one page", () => {
  it("shows every pick", () => {
    render(<OctoberPicks {...signedIn} />);
    expect(screen.getAllByTestId("pick-card")).toHaveLength(
      OCTOBER_PICKS.length,
    );
  });

  it("HOOK — leads with October's angle, not the film's genre", () => {
    render(<OctoberPicks {...signedIn} />);
    const lead = screen.getAllByTestId("pick-card")[0]!;
    const angle = angleOf(OCTOBER_PICKS[0]!.filmId)!;
    expect(within(lead).getByTestId("pick-angle")).toHaveTextContent(
      ANGLES[angle].label,
    );
  });

  it("VISUAL — a playable trailer sits on the card itself", () => {
    render(<OctoberPicks {...signedIn} />);
    expect(screen.getAllByTestId("trailer-poster").length).toBeGreaterThan(0);
  });

  it("WHY — October's paragraph is on the card, not behind a link", () => {
    render(<OctoberPicks {...signedIn} />);
    const lead = screen.getAllByTestId("pick-card")[0]!;
    expect(within(lead).getByTestId("pick-note")).toHaveTextContent(
      OCTOBER_PICKS[0]!.note.slice(0, 40),
    );
  });

  it("SAVE — keeps the film without leaving the page", async () => {
    const pick = OCTOBER_PICKS[0]!;
    render(<OctoberPicks {...signedIn} />);
    const card = screen
      .getAllByTestId("pick-card")
      .find((c) => c.dataset.filmId === pick.filmId)!;

    fireEvent.click(within(card).getByTestId("keep-on-card"));
    await waitFor(() => expect(calls).toHaveLength(1));

    expect(calls[0]!.url).toBe(`/api/october/things/${pick.filmId}`);
    expect(calls[0]!.body).toEqual({
      entityKind: "Movie",
      name: keepableFilm(filmById(pick.filmId)!).name,
      startsAt: null,
    });
  });

  it("offers the rest of the catalogue as the secondary move", () => {
    render(<OctoberPicks {...signedIn} />);
    expect(screen.getByTestId("see-all-movies")).toHaveAttribute(
      "href",
      "/october/movies",
    );
  });
});

describe("October's voice is never mistaken for a person's", () => {
  it("attributes every editorial paragraph to October", () => {
    render(<OctoberPicks {...signedIn} />);
    expect(screen.getAllByText("October says")).toHaveLength(
      OCTOBER_PICKS.length,
    );
  });

  it("shows no community opinion at all, because there is none to show", () => {
    render(<OctoberPicks {...signedIn} />);
    // `passport_movie_reactions` is private by RLS. Nothing on this page may
    // suggest otherwise — no counts, no quotes, no "people are saying".
    expect(screen.queryByTestId("you-said")).not.toBeInTheDocument();
    expect(screen.queryByText(/people/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/reviews?/i)).not.toBeInTheDocument();
  });
});

describe("signed out", () => {
  it("still gets the picks, the trailers and the reasons", () => {
    render(<OctoberPicks kept={new Set()} signedIn={false} />);
    expect(screen.getAllByTestId("pick-card")).toHaveLength(
      OCTOBER_PICKS.length,
    );
    expect(screen.getAllByTestId("pick-note").length).toBe(
      OCTOBER_PICKS.length,
    );
  });

  it("invites a sign-in rather than faking a save", () => {
    render(<OctoberPicks kept={new Set()} signedIn={false} />);
    expect(screen.queryAllByTestId("keep-on-card")).toHaveLength(0);
    expect(screen.getAllByTestId("keep-signed-out")[0]).toHaveAttribute(
      "href",
      `/auth?next=${encodeURIComponent("/october")}`,
    );
  });
});

describe("already kept", () => {
  it("renders saved on the first painted frame, asking nothing", () => {
    const pick = OCTOBER_PICKS[0]!;
    render(<OctoberPicks kept={new Set([pick.filmId])} signedIn />);
    const card = screen
      .getAllByTestId("pick-card")
      .find((c) => c.dataset.filmId === pick.filmId)!;
    expect(within(card).getByTestId("keep-on-card")).toHaveAttribute(
      "data-saved",
      "true",
    );
    expect(calls).toHaveLength(0);
  });
});
