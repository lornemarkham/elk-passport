import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CATALOGUE, type Film } from "@/lib/movies/catalogue";
import { Trailer } from "./Trailer";

/**
 * **A trailer, with no API and no guessed ids.**
 *
 * The rule is `/about/vision`'s, applied to films: a verified id embeds, and
 * anything else gets a search link. The thing these guard against is the
 * tempting version — an id that looks right, recalled rather than checked,
 * embedded on a card where nobody notices it is the wrong film.
 */
const film = (over: Partial<Film> = {}): Film => ({
  id: "test-film",
  title: "A Film",
  year: 1985,
  runtimeMinutes: 96,
  audience: "teens",
  fear: "spooky",
  mechanisms: ["dread"],
  line: "An authored sentence.",
  ...over,
});

describe("with a verified id", () => {
  it("shows a poster frame rather than loading a player", () => {
    render(<Trailer film={film({ trailerId: "abcdefghijk" })} />);
    expect(screen.getByTestId("trailer-poster")).toBeInTheDocument();
    // Forty-four cards must not mean forty-four YouTube players.
    expect(screen.queryByTestId("trailer-embed")).not.toBeInTheDocument();
  });

  it("uses YouTube's own thumbnail, which sets no cookie", () => {
    render(<Trailer film={film({ trailerId: "abcdefghijk" })} />);
    const img = screen.getByTestId("trailer-poster").querySelector("img")!;
    expect(img.getAttribute("src")).toBe(
      "https://img.youtube.com/vi/abcdefghijk/hqdefault.jpg",
    );
  });

  it("embeds only once asked, and only through youtube-nocookie", () => {
    render(<Trailer film={film({ trailerId: "abcdefghijk" })} />);
    fireEvent.click(screen.getByTestId("trailer-poster"));
    const frame = screen.getByTestId("trailer-embed");
    expect(frame.getAttribute("src")).toContain(
      "https://www.youtube-nocookie.com/embed/abcdefghijk",
    );
  });

  it("does not navigate the card it sits inside", () => {
    // The card's whole surface is a link; pressing play is not pressing it.
    const onCardClick = () => {
      throw new Error("the card navigated");
    };
    render(
      <div onClick={onCardClick}>
        <Trailer film={film({ trailerId: "abcdefghijk" })} />
      </div>,
    );
    expect(() =>
      fireEvent.click(screen.getByTestId("trailer-poster")),
    ).not.toThrow();
    expect(screen.getByTestId("trailer-embed")).toBeInTheDocument();
  });
});

describe("without one", () => {
  it("offers a search rather than guessing an id", () => {
    render(<Trailer film={film({ title: "Hereditary", year: 2018 })} />);
    expect(screen.queryByTestId("trailer-poster")).not.toBeInTheDocument();
    expect(screen.queryByTestId("trailer-embed")).not.toBeInTheDocument();
    expect(screen.getByTestId("trailer-search")).toHaveAttribute(
      "href",
      `https://www.youtube.com/results?search_query=${encodeURIComponent("Hereditary 2018 trailer")}`,
    );
  });
});

describe("the real catalogue", () => {
  it("renders something playable or findable for every single film", () => {
    for (const f of CATALOGUE) {
      const { unmount } = render(<Trailer film={f} />);
      const playable = screen.queryByTestId("trailer-poster");
      const findable = screen.queryByTestId("trailer-search");
      expect(Boolean(playable || findable), f.id).toBe(true);
      unmount();
    }
  });
});
