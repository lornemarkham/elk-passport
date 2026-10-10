import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Experience } from "@/domain/experience/types";
import type { CandidateGeography } from "@/lib/data/types";
import { PossibilityCard } from "./PossibilityCard";

/**
 * **What a card may claim about where something is.**
 *
 * Two badges competed for the same corner and meant different things. The
 * area badge answers *is this somewhere other than what this page is mostly
 * about*, which is a fact about the corpus. A distance answers *how far is
 * this from you*, which is a fact about the reader.
 *
 * Dogfooded in Vancouver, every card carried both — `UNDER 1 KM AWAY` beside
 * `METRO VANCOUVER` — to somebody standing outside the venue, because the page
 * is mostly about the Okanagan. One of those is useful to them and the other
 * is noise, so these pin which wins.
 */

const card = (
  geography: CandidateGeography | undefined,
  origin?: { latitude: number; longitude: number },
) =>
  render(
    <PossibilityCard
      experience={
        {
          id: "x",
          kind: "Place",
          slug: "x",
          title: "Commodore Ballroom",
          shortDescription: "A concert hall.",
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
          ...(geography ? { geography } : {}),
        } as Experience
      }
      home="Okanagan"
      {...(origin ? { origin } : {})}
      saved={false}
      saving={false}
      onSave={() => {}}
    />,
  );

/** The Commodore, as Atlas states it. */
const VANCOUVER: CandidateGeography = {
  state: "derived",
  locality: "Vancouver",
  localityBasis: "derived",
  coordinates: [-123.1207, 49.2827],
  coordinatesBasis: "derived",
  area: { id: "metro-vancouver", name: "Metro Vancouver" },
};

/** Atlas knows the area and not the point — 353 candidates look like this. */
const AREA_ONLY: CandidateGeography = {
  state: "observed",
  locality: "Vancouver",
  localityBasis: "observed",
  area: { id: "metro-vancouver", name: "Metro Vancouver" },
};

const IN_VANCOUVER = { latitude: 49.2827, longitude: -123.1207 };

describe("before the reader has shared where they are", () => {
  it("says only that this is somewhere other than the page's area", () => {
    card(VANCOUVER);
    expect(screen.getByTestId("possibility-area")).toHaveTextContent(
      "Metro Vancouver",
    );
    expect(
      screen.queryByTestId("possibility-distance"),
    ).not.toBeInTheDocument();
  });
});

describe("once they have", () => {
  it("replaces the corpus badge with a distance from them", () => {
    card(VANCOUVER, IN_VANCOUVER);
    expect(screen.getByTestId("possibility-distance")).toHaveTextContent(
      "Under 1 km away",
    );
    // "Elsewhere" is measured from the Okanagan. To somebody standing outside
    // the Commodore it is true and useless, and it contradicts the badge above.
    expect(screen.queryByTestId("possibility-area")).not.toBeInTheDocument();
  });

  it("keeps the area badge where Atlas states no coordinates", () => {
    // A missing coordinate is not evidence of distance, so the card falls back
    // to the one geographic fact it does have rather than going silent.
    card(AREA_ONLY, IN_VANCOUVER);
    expect(
      screen.queryByTestId("possibility-distance"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("possibility-area")).toHaveTextContent(
      "Metro Vancouver",
    );
  });

  it("says nothing at all about a card Atlas has not placed", () => {
    card({ state: "unknown" }, IN_VANCOUVER);
    expect(
      screen.queryByTestId("possibility-distance"),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("possibility-area")).not.toBeInTheDocument();
  });

  it("never invents a position from a name or a venue string", () => {
    card(undefined, IN_VANCOUVER);
    expect(
      screen.queryByTestId("possibility-distance"),
    ).not.toBeInTheDocument();
  });
});
