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
});
