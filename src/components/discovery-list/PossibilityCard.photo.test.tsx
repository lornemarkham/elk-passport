import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PossibilityCard } from "./PossibilityCard";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import type { DiscoveryCandidate } from "@/lib/data/types";

/**
 * **A fifth of Discovery has no photograph, and that is the normal case.**
 *
 * Measured against production Atlas on 2026-10-11: a lead image is published
 * for **536 of 2,680** subjects. So a card without one is not an edge case to
 * degrade into — it is what a lot of the product looks like, and it was an
 * empty 4:3 rectangle with the words "No photograph" in the corner. Four in a
 * row read as a page that had failed to load.
 */
const card = (over: Partial<DiscoveryCandidate>, props = {}) => {
  const experience = candidateToExperience({
    id: "id",
    kind: "Place",
    name: "The Boarding House Cafe",
    subtype: "cafe",
    description: "A cafe in Vernon offering coffee and baked goods.",
    mediaCount: 0,
    containsCount: 0,
    regionIds: [],
    ...over,
  });
  return render(
    <ul>
      <PossibilityCard
        experience={experience}
        saved={false}
        saving={false}
        onSave={vi.fn()}
        {...props}
      />
    </ul>,
  );
};

describe("a card with no photograph", () => {
  it("fills the slot with what the thing is, at display size", () => {
    card({});
    const panel = screen.getByTestId("possibility-untitled");
    expect(panel).toHaveTextContent("cafe");
    // The proportions of the shelf are unchanged — this is the same slot a
    // photograph would have occupied, not a collapsed card.
    expect(panel.className).toContain("aspect-[4/3]");
  });

  it("never says 'No photograph' at anybody", () => {
    card({});
    expect(screen.queryByText(/no photograph/i)).toBeNull();
  });

  it("does not print the name twice", () => {
    // The first version set the title large in the slot, six pixels above the
    // `h3` that already carries it — a stutter on screen and the same string
    // twice in the accessibility tree.
    card({});
    expect(screen.getAllByText("The Boarding House Cafe")).toHaveLength(1);
  });

  it("falls back to the kind where Atlas states no subtype", () => {
    card({ subtype: undefined });
    expect(screen.getByTestId("possibility-untitled")).toHaveTextContent(
      "Place",
    );
  });

  it("is still a link to its own page", () => {
    card({});
    expect(
      screen.getByRole("link", { name: "The Boarding House Cafe" }),
    ).toBeTruthy();
  });
});

describe("a photograph that does not arrive", () => {
  /**
   * Atlas's images are served from dozens of publishers' own hosts. One being
   * down, moved or hotlink-protected is an ordinary Tuesday — measured on the
   * live page, one card in fifty rendered the browser's broken-image glyph.
   */
  it("becomes the text-first card rather than a torn icon", () => {
    card({ heroUrl: "https://example.com/gone.jpg" });
    expect(screen.queryByTestId("possibility-untitled")).toBeNull();

    fireEvent.error(screen.getByRole("presentation", { hidden: true }));
    expect(screen.getByTestId("possibility-untitled")).toBeTruthy();
    expect(document.querySelector("img")).toBeNull();
  });
});
