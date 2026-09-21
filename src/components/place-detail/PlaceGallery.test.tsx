import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PlaceGallery } from "./PlaceGallery";
import type {
  Place,
  PlaceMediaView,
  PlaceRepresentativeMedia,
  PlaceSource,
} from "@/lib/data/types";
import type { PlaceSectionProps } from "./types";

/**
 * The gallery shows Atlas's representative set beyond the hero, and nothing
 * else can reach it: the detail read never carries an undecided or rejected
 * image, so the component has no way to show one. What is pinned here is
 * Passport's own two rules (hero left out, no gallery under two) and that the
 * lightbox is usable — opens on a tile, moves with the arrow keys, names the
 * caption and the publisher, closes.
 */

const place: Place = {
  kind: "Place",
  id: "knox",
  name: "Knox Mountain Park",
  aliases: [],
  placeType: "park",
  description: "Kelowna's largest natural area.",
};

const image = (
  url: string,
  over: Partial<PlaceMediaView> = {},
): PlaceMediaView => ({
  url,
  sourceRecordId: "sr-tourism",
  evidence: "curator",
  ...over,
});

const sources: PlaceSource[] = [
  {
    id: "sr-tourism",
    sourceType: "tourism-authority",
    source: "https://www.tourismkelowna.com/x",
    retrievedAt: "2026-09-01T00:00:00.000Z",
  },
  {
    id: "sr-bcparks",
    sourceType: "bcparks",
    source: "https://bcparks.ca/knox/",
    retrievedAt: "2026-09-01T00:00:00.000Z",
  },
];

const props = (
  media: PlaceRepresentativeMedia | undefined,
): PlaceSectionProps => ({
  place,
  relationships: [],
  sources,
  relatedPlaces: [],
  relatedPlaceDetails: [],
  media,
});

const HERO = image("https://cdn/hero.jpg", {
  caption: "Knox Mountain Park lookout",
});
const SUMMIT = image("https://cdn/summit.jpg", {
  caption: "Apex Trail summit",
  sourceRecordId: "sr-bcparks",
  evidence: "source-subject",
});
const TRAIL = image("https://cdn/trail.jpg", { caption: "Paul's Tomb trail" });
const LAKE = image("https://cdn/lake.jpg");

describe("PlaceGallery", () => {
  it("renders nothing — no heading, no shell — when Atlas vouches for fewer than two images beyond the hero", () => {
    const { container: none } = render(<PlaceGallery {...props(undefined)} />);
    expect(none).toBeEmptyDOMElement();
    const { container: lone } = render(
      <PlaceGallery {...props({ hero: HERO, gallery: [HERO] })} />,
    );
    expect(lone).toBeEmptyDOMElement();
    const { container: one } = render(
      <PlaceGallery {...props({ hero: HERO, gallery: [HERO, SUMMIT] })} />,
    );
    expect(one).toBeEmptyDOMElement();
    expect(screen.queryByText("Photos")).toBeNull();
  });

  it("renders one tile per representative image beyond the hero, in Atlas's order, never the hero's file", () => {
    render(
      <PlaceGallery
        {...props({ hero: HERO, gallery: [HERO, SUMMIT, TRAIL, LAKE] })}
      />,
    );
    expect(screen.getByText("Photos")).toBeInTheDocument();
    const tiles = screen.getAllByRole("button", { name: /View photo/ });
    expect(
      tiles.map((t) => t.querySelector("img")?.getAttribute("src")),
    ).toEqual([
      "https://cdn/summit.jpg",
      "https://cdn/trail.jpg",
      "https://cdn/lake.jpg",
    ]);
    expect(
      document.querySelector('img[src="https://cdn/hero.jpg"]'),
    ).toBeNull();
    // The caption is the alt text, verbatim; an image without one is decorative.
    expect(tiles[0]!.querySelector("img")?.getAttribute("alt")).toBe(
      "Apex Trail summit",
    );
    expect(tiles[2]!.querySelector("img")?.getAttribute("alt")).toBe("");
  });

  it("opens a lightbox on a tile with the caption, the publisher and the position; arrow keys move through it and wrap", () => {
    render(
      <PlaceGallery
        {...props({ hero: HERO, gallery: [HERO, SUMMIT, TRAIL, LAKE] })}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "View photo: Apex Trail summit" }),
    );
    const shown = () =>
      screen.getByTestId("place-gallery-lightbox-image").getAttribute("src");
    expect(shown()).toBe("https://cdn/summit.jpg");
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Photo: BC Parks/ }),
    ).toHaveAttribute("href", "https://bcparks.ca/knox/");
    const lightbox = () => screen.getByTestId("place-gallery-lightbox-image");
    fireEvent.keyDown(lightbox(), { key: "ArrowRight" });
    expect(shown()).toBe("https://cdn/trail.jpg");
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Photo: Tourism Authority/ }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next photo" }));
    expect(shown()).toBe("https://cdn/lake.jpg");
    fireEvent.keyDown(lightbox(), { key: "ArrowRight" });
    expect(shown()).toBe("https://cdn/summit.jpg");
    fireEvent.keyDown(lightbox(), { key: "ArrowLeft" });
    expect(shown()).toBe("https://cdn/lake.jpg");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByTestId("place-gallery-lightbox-image")).toBeNull();
  });

  it("with no hero, every representative image is the gallery", () => {
    render(<PlaceGallery {...props({ gallery: [SUMMIT, TRAIL] })} />);
    expect(screen.getAllByRole("button", { name: /View photo/ })).toHaveLength(
      2,
    );
  });
});
