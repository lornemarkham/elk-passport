import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Experience } from "@/domain/experience/types";
import { journeyFromReading } from "@/lib/routing/atlasTravel";
import type { Journey } from "@/lib/routing/journey";
import { DRIVING_FROM_VERNON, VERNON } from "@/lib/routing/fixtures";
import { PossibilityCard } from "./PossibilityCard";

/**
 * **A card says a drive time only when Atlas routed one** (ADR 097).
 *
 * Fintry is the case: 22 km in a straight line and 61 minutes around the
 * lake. A card that kept saying "22 km" would read as twenty minutes away.
 */
const reading = (id: string): Journey =>
  journeyFromReading(
    DRIVING_FROM_VERNON.candidates.find((c) => c.id === id)!.travel,
    "driving",
  );

const card = (travel: Journey | undefined) =>
  render(
    <PossibilityCard
      experience={
        {
          id: "fintry-provincial-park",
          kind: "Place",
          slug: "fintry",
          title: "Fintry Provincial Park",
          shortDescription: "A park.",
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
          distance: { state: "measured", km: 22, basis: "coordinates" },
          ...(travel ? { travel } : {}),
        } as Experience
      }
      origin={VERNON}
      saved={false}
      saving={false}
      onSave={() => {}}
    />,
  );

const pill = () => screen.getByTestId("possibility-distance");

describe("PossibilityCard — travel", () => {
  it("shows Atlas's routed drive time, with its caveat to hand", () => {
    card(reading("fintry-provincial-park"));
    expect(pill().dataset.journey).toBe("routed");
    expect(pill().textContent).toMatch(/1 h 1 min drive/);
    expect(pill().title).toMatch(/Estimated by osrm-demo/);
  });

  it("keeps the straight line when there is no routed time", () => {
    card(undefined);
    expect(pill().dataset.journey).toBe("straight-line");
    expect(pill().textContent).toMatch(/22 km/);
  });

  it("keeps the straight line when the routed time carries a caution", () => {
    card(reading("kalamalka-lake-park"));
    expect(pill().dataset.journey).toBe("straight-line");
    expect(pill().textContent).not.toMatch(/min/);
  });

  it("keeps the straight line when Atlas found no route", () => {
    card(reading("monashee-backcountry"));
    expect(pill().dataset.journey).toBe("straight-line");
  });
});
