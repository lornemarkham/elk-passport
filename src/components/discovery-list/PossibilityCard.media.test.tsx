import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Experience } from "@/domain/experience/types";
import { PossibilityCard } from "./PossibilityCard";

/**
 * **What a card shows where there is a picture, a venue's picture, a broken
 * one, or none** (Mission 084 handoff §3). Atlas withholds most missing
 * photographs on purpose; Passport's job is to fail gracefully and never to
 * pass a building off as the event.
 */
const base = {
  id: "x",
  kind: "Event",
  slug: "x",
  title: "Harvest Pumpkin Festival",
  shortDescription: "Pumpkins.",
  isActive: true,
  detailReady: true,
  moods: [],
  activities: [],
  seasons: [],
  timeOfDay: [],
  weather: [],
  companions: [],
  energyLevel: 1,
  priceLevel: 0,
  duration: { minMinutes: 0, maxMinutes: 0 },
  regionIds: [],
  familyFriendly: false,
  petFriendly: false,
  requiresReservation: false,
} as unknown as Experience;

const card = (experience: Experience) =>
  render(
    <PossibilityCard
      experience={experience}
      saved={false}
      saving={false}
      onSave={() => {}}
    />,
  );

describe("a card's picture", () => {
  it("leads with words, not an empty box, when there is no picture", () => {
    card(base);
    expect(screen.getByTestId("possibility-text-lead")).toHaveTextContent(
      "Harvest Pumpkin Festival",
    );
    expect(screen.queryByText("No photograph")).toBeNull();
    // One heading, not the name printed twice.
    expect(screen.getAllByText("Harvest Pumpkin Festival")).toHaveLength(1);
  });

  it("falls back to the text lead when the picture fails to load", () => {
    const { container } = card({
      ...base,
      heroMedia: { type: "image", src: "https://example.test/gone.jpg" },
    });
    const img = container.querySelector("img")!;
    expect(screen.queryByTestId("possibility-text-lead")).toBeNull();
    fireEvent.error(img);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByTestId("possibility-text-lead")).toBeInTheDocument();
  });

  it("labels a venue's picture as the venue's, never the event's", () => {
    card({
      ...base,
      contextualMedia: {
        heroUrl: "https://example.test/barn.jpg",
        via: { id: "v", kind: "Organization", name: "Davison Orchards" },
      },
    });
    expect(screen.getByTestId("possibility-venue-photo")).toHaveTextContent(
      "Venue photo · Davison Orchards",
    );
  });

  it("prefers the subject's own picture over its venue's", () => {
    card({
      ...base,
      heroMedia: { type: "image", src: "https://example.test/own.jpg" },
      contextualMedia: {
        heroUrl: "https://example.test/barn.jpg",
        via: { id: "v", kind: "Organization", name: "Davison Orchards" },
      },
    });
    expect(screen.queryByTestId("possibility-venue-photo")).toBeNull();
  });
});

describe("what a card says about the answers above", () => {
  it("says plainly when nothing about age was found, and rules nothing out", () => {
    card({
      ...base,
      suitability: {
        forAge: { age: 5, reading: "unknown", because: [] },
      } as unknown as Experience["suitability"],
    });
    expect(screen.getByTestId("possibility-age")).toHaveTextContent(
      "No age guidance found",
    );
  });

  it("says a distance to a town centre as the town, not as a door-to-door number", () => {
    render(
      <PossibilityCard
        experience={{
          ...base,
          distance: {
            state: "measured",
            km: 0.4,
            basis: "town",
            town: "Vernon",
            within: true,
          },
        }}
        origin={{ latitude: 50.27, longitude: -119.27 }}
        saved={false}
        saving={false}
        onSave={() => {}}
      />,
    );
    expect(screen.getByTestId("possibility-distance")).toHaveTextContent(
      "In Vernon",
    );
  });

  describe("Atlas's presentation image (ADR 106)", () => {
    const image = (over: Record<string, unknown>) => ({
      url: "https://example.test/p.jpg",
      relationship: "category",
      depictsEntity: false,
      confidence: "low",
      source: { host: "commons.wikimedia.org", evidence: "licensed:CC BY 4.0" },
      attribution:
        "Illustrative market photo by Someone (CC BY 4.0). Not a photo of Harvest Pumpkin Festival.",
      license: { name: "CC BY 4.0", author: "Someone" },
      ...over,
    });

    it("shows it, says it is illustrative, and credits its author", () => {
      const { container } = card({
        ...base,
        presentationImage: image({}),
      } as unknown as Experience);
      expect(container.querySelector("img")!.getAttribute("src")).toBe(
        "https://example.test/p.jpg",
      );
      expect(
        screen.getByTestId("possibility-presented-label"),
      ).toHaveTextContent("Illustrative photo · Someone, CC BY 4.0");
      expect(screen.queryByTestId("possibility-text-lead")).toBeNull();
    });

    it("labels a venue's picture with whose it is", () => {
      card({
        ...base,
        presentationImage: image({
          relationship: "venue",
          source: {
            host: "x",
            evidence: "curator",
            heldBy: { id: "v", kind: "Place", name: "Prospera Place" },
          },
        }),
      } as unknown as Experience);
      expect(
        screen.getByTestId("possibility-presented-label"),
      ).toHaveTextContent("Venue photo · Prospera Place");
    });

    it("shows an exact picture without a label", () => {
      card({
        ...base,
        presentationImage: image({
          relationship: "exact",
          depictsEntity: true,
        }),
      } as unknown as Experience);
      expect(screen.queryByTestId("possibility-presented-label")).toBeNull();
    });

    it("never replaces the candidate's own picture", () => {
      const { container } = card({
        ...base,
        heroMedia: { type: "image", src: "https://example.test/own.jpg" },
        presentationImage: image({}),
      } as unknown as Experience);
      expect(container.querySelector("img")!.getAttribute("src")).toBe(
        "https://example.test/own.jpg",
      );
      expect(screen.queryByTestId("possibility-presented-label")).toBeNull();
    });

    it("falls back to the text lead when the presented picture fails to load", () => {
      const { container } = card({
        ...base,
        presentationImage: image({}),
      } as unknown as Experience);
      fireEvent.error(container.querySelector("img")!);
      expect(container.querySelector("img")).toBeNull();
      expect(screen.getByTestId("possibility-text-lead")).toBeInTheDocument();
    });
  });
});

/**
 * **Regression: a card with a labelled picture lost its title and kind.**
 * The heading and the kind tag were gated on a lead picture or a venue photo,
 * so every card carrying Atlas's `presentationImage` (2,089 in production)
 * showed a picture and no name. Pinned for every kind of entity.
 */
describe("a labelled picture still has a title and a kind (all entity kinds)", () => {
  const kinds = [
    "Place",
    "Organization",
    "Activity",
    "Event",
    "Experience",
  ] as const;
  const labelled = (
    relationship: string,
    over: Record<string, unknown> = {},
  ) => ({
    url: "https://example.test/p.jpg",
    relationship,
    depictsEntity: false,
    confidence: "low",
    attribution: "x",
    ...over,
  });

  describe.each(kinds)("%s", (kind) => {
    it.each(["exact", "venue", "organization", "representative", "category"])(
      "keeps its heading and kind tag with a %s picture",
      (relationship) => {
        card({
          ...base,
          kind,
          subtype: "Pumpkin patch",
          title: "Aldor Acres Fall Pumpkin Patch",
          presentationImage: labelled(relationship),
        } as unknown as Experience);
        expect(
          screen.getByRole("heading", {
            name: "Aldor Acres Fall Pumpkin Patch",
          }),
        ).toBeInTheDocument();
        expect(screen.getByText("Pumpkin patch")).toBeInTheDocument();
        expect(screen.queryByTestId("possibility-text-lead")).toBeNull();
      },
    );
  });

  it("does not crash when the wire dropped `source` (no heldBy) or `license`", () => {
    for (const relationship of ["venue", "organization", "category"]) {
      const { unmount } = card({
        ...base,
        presentationImage: labelled(relationship),
      } as unknown as Experience);
      expect(
        screen.getByTestId("possibility-presented-label"),
      ).toBeInTheDocument();
      unmount();
    }
    card({
      ...base,
      presentationImage: labelled("category", {
        license: { name: "CC BY 4.0" },
      }),
    } as unknown as Experience);
    expect(screen.getByTestId("possibility-presented-label")).toHaveTextContent(
      "Illustrative photo",
    );
  });

  it("prefers the venue's own photograph over an illustrative one", () => {
    for (const relationship of ["category", "representative"]) {
      const { container, unmount } = card({
        ...base,
        contextualMedia: {
          heroUrl: "https://example.test/barn.jpg",
          via: { id: "v", kind: "Organization", name: "Davison Orchards" },
        },
        presentationImage: labelled(relationship),
      } as unknown as Experience);
      expect(container.querySelector("img")!.getAttribute("src")).toBe(
        "https://example.test/barn.jpg",
      );
      expect(screen.getByTestId("possibility-venue-photo")).toBeInTheDocument();
      unmount();
    }
  });

  it("keeps an authentic presented picture over the venue's contextual one", () => {
    const { container } = card({
      ...base,
      contextualMedia: {
        heroUrl: "https://example.test/barn.jpg",
        via: { id: "v", kind: "Organization", name: "Davison Orchards" },
      },
      presentationImage: labelled("venue"),
    } as unknown as Experience);
    expect(container.querySelector("img")!.getAttribute("src")).toBe(
      "https://example.test/p.jpg",
    );
  });

  it("falls to the illustrative photo when the venue photo is broken", () => {
    const { container } = card({
      ...base,
      contextualMedia: {
        heroUrl: "https://example.test/barn.jpg",
        via: { id: "v", kind: "Organization", name: "Davison Orchards" },
      },
      presentationImage: labelled("category"),
    } as unknown as Experience);
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")!.getAttribute("src")).toBe(
      "https://example.test/p.jpg",
    );
  });

  it("lets a long title and a long credit wrap instead of overflowing", () => {
    card({
      ...base,
      title: "Supercalifragilisticexpialidocious".repeat(4),
      presentationImage: labelled("category", {
        license: {
          name: "CC BY-SA 4.0",
          author: "A Photographer With A Very Long Name",
        },
      }),
    } as unknown as Experience);
    const label = screen.getByTestId("possibility-presented-label");
    expect(label.className).toContain("line-clamp-2");
    expect(label.className).not.toContain("truncate");
    expect(screen.getByRole("heading").className).toContain(
      "[overflow-wrap:anywhere]",
    );
  });
});
