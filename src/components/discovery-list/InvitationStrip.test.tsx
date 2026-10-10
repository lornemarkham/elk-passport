import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Experience } from "@/domain/experience/types";
import type { Invitation } from "@/domain/discovery/directions";
import { InvitationStrip } from "./InvitationStrip";

/**
 * **An invitation has to be something, and it has to prove it.**
 *
 * A verb on its own is a category — *Hiking* is what a filter chip says. A
 * verb with Kal Beach and Kin Beach underneath it is somewhere to go tonight.
 * So these pin the proof, and the far more important thing the proof must not
 * become: a promise about hours, price, duration, suitability or weather, none
 * of which Atlas states and all of which a tempting bit of copy would invent.
 */

const place = (title: string) => ({ id: title, title }) as Experience;

const invitation = (
  doing: string,
  count: number,
  ...examples: string[]
): Invitation => ({
  doing,
  places: [...Array(count)].map((_, i) => place(`${doing} place ${i}`)),
  examples: examples.map(place),
});

const strip = (
  invitations: readonly Invitation[],
  near: boolean,
  selected?: string,
  onSelect = vi.fn(),
) => {
  render(
    <InvitationStrip
      invitations={invitations}
      near={near}
      {...(selected ? { selected } : {})}
      onSelect={onSelect}
    />,
  );
  return onSelect;
};

const VERNON = [
  invitation("Hiking", 34, "Turtle Mountain", "Middleton Mountain"),
  invitation("Swimming", 21, "Kal Beach", "Kin Beach"),
  invitation("Playground", 15, "Polson Park", "Armoury Park"),
  invitation("Fishing", 14, "Kekuli Bay Provincial Park", "Kalamalka Lake"),
];

describe("what a tile says", () => {
  it("names the thing you could do, in Atlas's own word", () => {
    strip(VERNON, true);
    expect(
      [...screen.getAllByTestId("invitation")].map(
        (tile) => tile.dataset["doing"],
      ),
    ).toEqual(["Hiking", "Swimming", "Playground", "Fishing"]);
  });

  it("names real places underneath, so it is an offer and not a category", () => {
    strip(VERNON, true);
    expect(screen.getByText("Kal Beach · Kin Beach")).toBeInTheDocument();
  });

  it("promises nothing Atlas does not state", () => {
    strip(VERNON, true);
    const said = screen.getByTestId("invitations").textContent!.toLowerCase();
    // No hours, no duration, no price, no age guidance, no weather. Atlas
    // states opening hours for 6% of the corpus and duration for 1%.
    for (const invented of [
      "open",
      "hour",
      "minute",
      "free",
      "$",
      "kids",
      "sunny",
      "perfect",
      "best",
    ]) {
      expect(said).not.toContain(invented);
    }
  });
});

describe("the geographic claim a count makes", () => {
  it("says near you only once the person has shared where they are", () => {
    strip(VERNON, true);
    expect(screen.getByTestId("invitations")).toHaveTextContent(
      "Things you could do near you",
    );
    expect(screen.getByTestId("invitations")).toHaveTextContent(
      "34 places near you",
    );
  });

  it("claims nothing about distance until then", () => {
    // Declining location must not quietly turn the whole corpus into "near
    // you" — an Okanagan swim is not on offer to somebody in Vancouver.
    strip(VERNON, false);
    const said = screen.getByTestId("invitations").textContent!;
    expect(said).toContain("Things you could do");
    expect(said).not.toContain("near you");
    expect(said).toContain("34 places");
  });
});

describe("tapping one", () => {
  it("asks the page for that direction", () => {
    const onSelect = strip(VERNON, true);
    fireEvent.click(screen.getAllByTestId("invitation")[1]!);
    expect(onSelect).toHaveBeenCalledWith("Swimming");
  });

  it("tapping the chosen one again puts it back", () => {
    const onSelect = strip(VERNON, true, "Swimming");
    fireEvent.click(screen.getAllByTestId("invitation")[1]!);
    expect(onSelect).toHaveBeenCalledWith(undefined);
  });

  it("says which one is chosen, to something other than a colour", () => {
    strip(VERNON, true, "Swimming");
    const tiles = screen.getAllByTestId("invitation");
    expect(tiles[1]).toHaveAttribute("aria-pressed", "true");
    expect(tiles[0]).toHaveAttribute("aria-pressed", "false");
  });
});

describe("when there is nothing to offer", () => {
  it("offers nothing, rather than an empty heading", () => {
    // Atlas states affordances for 224 of 2,683 candidates. A pool with none
    // is an ordinary outcome and the page below it still works.
    const { container } = render(
      <InvitationStrip invitations={[]} near={false} onSelect={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
