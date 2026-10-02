import { afterEach, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { DoingTile } from "./DoingTile";
import { forgetEverythingKept } from "@/components/october/save/keeping";
import { MAKING, type Doing } from "@/lib/making/catalogue";

/**
 * **The tile has one job the card never had: make somebody want to open it.**
 *
 * So what is tested here is not that it renders. It is the three things that
 * decide whether the page is browsable — that a lead actually outweighs the
 * rest, that the picture opens the thing rather than decorating it, and that
 * the credit the licence requires is on screen rather than in a comment.
 *
 * The fourth is the one most likely to go wrong later: a Doing with no
 * photograph must still look deliberate. Half this catalogue has no picture,
 * and the first time a missing image renders as a broken tile, the whole page
 * reads as unfinished.
 */
const withPicture = MAKING.find((d) => d.image)!;
const withoutPicture = MAKING.find((d) => !d.image)!;

function show(doing: Doing, lead = false) {
  return render(
    <DoingTile doing={doing} saved={false} signedIn={false} lead={lead} />,
  );
}

afterEach(() => forgetEverythingKept());

describe("a Doing you can see", () => {
  it("opens the Doing when you click the picture, not a lightbox", () => {
    show(withPicture);
    const link = screen.getByRole("link", { name: withPicture.title });
    expect(link).toHaveAttribute("href", `/october/make/${withPicture.id}`);
  });

  it("shows the photographer and the licence on the tile itself", () => {
    show(withPicture);
    expect(
      screen.getByText(
        new RegExp(
          `${withPicture.image!.credit}.*${withPicture.image!.licence.replace(/ /g, " ")}`,
        ),
      ),
    ).toBeInTheDocument();
  });

  it("describes the photograph without claiming it is the reader's", () => {
    show(withPicture);
    const img = screen.getByAltText(withPicture.image!.alt);
    expect(img).toHaveAttribute("src", withPicture.image!.src);
    expect(withPicture.image!.alt).not.toMatch(/\byour\b/i);
  });

  it("leads at a different weight from the tiles around it", () => {
    const { container: big } = show(withPicture, true);
    const { container: small } = show(withPicture, false);
    const className = (c: HTMLElement) =>
      c.querySelector("img")!.getAttribute("class") ?? "";
    expect(className(big)).toContain("aspect-[16/9]");
    expect(className(small)).toContain("aspect-[4/3]");
    expect(within(big).getByRole("heading").getAttribute("class")).not.toEqual(
      within(small).getByRole("heading").getAttribute("class"),
    );
  });
});

describe("a Doing with no honest photograph", () => {
  it("sets the sentence as the tile instead of showing an empty frame", () => {
    const { container } = show(withoutPicture);
    expect(container.querySelector("img")).toBeNull();
    // No picture-shaped hole waiting for a picture.
    expect(container.innerHTML).not.toContain("aspect-[");
    // It still occupies a tile's worth of the row, carried by the hook.
    expect(container.innerHTML).toContain("min-h-[180px]");
    const hook = screen.getByText(
      withoutPicture.detail?.hook ?? withoutPicture.line,
    );
    expect(hook.className).toContain("font-heading");
    expect(screen.getByRole("heading")).toHaveTextContent(withoutPicture.title);
  });

  it("says nothing about an image that is not there", () => {
    show(withoutPicture);
    expect(screen.queryByText(/CC BY/)).toBeNull();
  });

  it("is still openable and still savable", () => {
    render(<DoingTile doing={withoutPicture} saved={false} signedIn />);
    expect(
      screen.getByRole("link", { name: withoutPicture.title }),
    ).toHaveAttribute("href", `/october/make/${withoutPicture.id}`);
    // Missing a photograph must never cost it the save mark.
    expect(screen.getByRole("button")).toBeInTheDocument();
  });
});
