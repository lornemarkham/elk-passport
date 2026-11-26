import { describe, expect, it } from "vitest";
import type { Experience } from "@/domain/experience/types";
import { townById } from "@/domain/discovery/towns";
import { answer, findsIn } from "./discover";
import { planItinerary, readEdits } from "./itinerary";
import { readRequest } from "./request";

/**
 * **Recommendation quality from the customer review** (owner brief M1128,
 * §9; evidence in `docs/product/christmas/ATLAS-QUALITY-M1128.md`). The
 * Passport-side rules: Atlas's records are left as they are, and what
 * Passport shows from them is honest.
 */

const TODAY = "2026-11-25";

function exp(over: Partial<Experience>): Experience {
  return {
    id: over.id ?? over.title ?? "x",
    kind: "Place",
    slug: "x",
    title: "Somewhere",
    shortDescription: "",
    detailReady: false,
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
    isActive: true,
    ...over,
  };
}

const vernon = townById("vernon")!;
function at(kmEast: number, over: Partial<Experience>): Experience {
  const dLng = kmEast / (111.32 * Math.cos((vernon.latitude * Math.PI) / 180));
  return exp({
    geography: {
      state: "observed",
      coordinates: [vernon.longitude + dLng, vernon.latitude],
      coordinatesBasis: "observed",
      area: { id: vernon.area.toLowerCase(), name: vernon.area },
    },
    ...over,
  });
}

const origin = {
  id: "vernon",
  name: "Vernon",
  latitude: vernon.latitude,
  longitude: vernon.longitude,
};
const plan = (say: string, experiences: Experience[]) =>
  planItinerary(
    readRequest(say, TODAY),
    { experiences, pins: [], origin, today: TODAY },
    readEdits({}),
  );

describe("a romantic dinner is a dinner", () => {
  it("does not plan a place that says it is for breakfast over a real restaurant", () => {
    const p = plan("Romantic dinner on Dec 5", [
      at(0.5, {
        id: "brekkie",
        title: "Eatology",
        subtype: "restaurant",
        description: "A spot for a leisurely breakfast.",
      }),
      at(2, {
        id: "bistro",
        title: "Harbour Bistro",
        subtype: "restaurant",
        description: "An intimate restaurant for dinner by candlelight.",
      }),
    ]);
    const dinner = p.stops.find((s) => s.need === "dinner");
    expect(dinner?.place?.ref).toBe("atlas:bistro");
  });
});

describe("one place listed twice is one alternative", () => {
  it("offers RANGE once, not three times", () => {
    const range = (id: string, title: string, east: number) =>
      at(east, { id, title, subtype: "restaurant", description: "Dinner." });
    const p = plan("Dinner on Dec 5", [
      range("r1", "RANGE Restaurant", 1),
      range("r2", "RANGE", 1.0005),
      range("r3", "RANGE Restaurant & Lounge", 1.001),
      at(3, {
        id: "other",
        title: "Other Place",
        subtype: "restaurant",
        description: "Dinner.",
      }),
    ]);
    const dinner = p.stops.find((s) => s.need === "dinner")!;
    const titles = [
      dinner.place!.title,
      ...dinner.alternatives.map((a) => a.title),
    ];
    expect(titles.filter((t) => t.startsWith("RANGE"))).toHaveLength(1);
  });
});

describe("a winery's light-up tasting is not a lights display", () => {
  it("leaves it off a lights stop", () => {
    const p = plan("The Christmas lights on Dec 5", [
      at(2, {
        id: "tasting",
        kind: "Event",
        title: "Holiday Light-Up Wine Tasting",
        startTime: "2026-12-06T01:00:00Z",
        endTime: "2026-12-06T04:00:00Z",
        timePrecision: "minute",
        occurrence: { reading: "occurrence", actionable: true },
      }),
    ]);
    const lights = p.stops.find((s) => s.need === "lights");
    expect(lights?.place?.ref).not.toBe("atlas:tasting");
  });
});

describe("an unplaced twin of a placed listing is the same thing", () => {
  it("is not counted again as somewhere unknown", () => {
    const placed = at(1, {
      id: "placed",
      kind: "Event",
      title: "Silver Star Annual Light Up",
      startTime: "2026-12-06T00:30:00Z",
      endTime: "2026-12-06T03:15:00Z",
      timePrecision: "minute",
      occurrence: { reading: "occurrence", actionable: true },
    });
    const unplaced = exp({ ...placed, id: "unplaced", geography: undefined });
    const result = answer(findsIn([placed, unplaced], TODAY), {
      at: "vernon",
      km: 30,
      ages: [],
      themes: [],
      budget: "any",
    });
    expect(result.unplaced).toBe(0);
  });
});
