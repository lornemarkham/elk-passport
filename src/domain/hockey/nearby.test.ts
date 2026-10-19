import { describe, expect, it } from "vitest";
import type { DiscoveryCandidate } from "@/lib/data/types";
import { nearbyFood, nearbyWithCurated, walkLabel } from "./nearby";

/**
 * Synthetic candidates — shapes, not places. No real Vancouver venue is
 * named here, because nothing here has been checked against Atlas.
 */
const ARENA: [number, number] = [49.2778, -123.1088];

function candidate(
  id: string,
  subtype: string,
  lngLat: [number, number] | undefined,
  basis: "observed" | "derived" = "observed",
  extra: Partial<DiscoveryCandidate> = {},
): DiscoveryCandidate {
  return {
    id,
    kind: "Place",
    name: `Synthetic ${id}`,
    subtype,
    geography: lngLat
      ? { state: basis, coordinates: lngLat, coordinatesBasis: basis }
      : { state: "unknown" },
    ...extra,
  } as unknown as DiscoveryCandidate;
}

describe("food near the arena", () => {
  const places = nearbyFood(
    [
      candidate("pub", "Pub", [-123.1065, 49.2785]), // ~0.2 km
      candidate("bistro", "bistro", [-123.115, 49.28]), // ~0.5 km
      candidate("museum", "museum", [-123.108, 49.278]), // close, not food
      candidate("far-cafe", "cafe", [-123.03, 49.26]), // ~6 km
      candidate("derived", "restaurant", [-123.109, 49.2779], "derived"),
      candidate("nowhere", "restaurant", undefined),
      candidate("atlas-measured", "brewery", undefined, "observed", {
        distance: { state: "measured", km: 0.9, basis: "coordinates" },
      } as Partial<DiscoveryCandidate>),
      candidate("town-centre", "restaurant", undefined, "observed", {
        distance: {
          state: "measured",
          km: 0.1,
          basis: "town",
          town: "Vancouver",
        },
      } as Partial<DiscoveryCandidate>),
    ],
    ARENA,
  );
  const ids = places.map((p) => p.atlasId);

  it("uses Discovery's own Eat & drink meaning, case and all", () => {
    expect(ids).toContain("pub");
    expect(ids).toContain("bistro");
    expect(ids).not.toContain("museum");
  });

  it("measures only what Atlas actually located, never a derived or town-centre point", () => {
    expect(ids).not.toContain("derived");
    expect(ids).not.toContain("nowhere");
    expect(ids).not.toContain("town-centre");
    expect(ids).toContain("atlas-measured");
  });

  it("stays within a walk, nearest first", () => {
    expect(ids).not.toContain("far-cafe");
    expect(ids).toEqual(["pub", "bistro", "atlas-measured"]);
  });

  it("calls every distance a straight-line estimate", () => {
    expect(places.every((p) => p.basis === "straight-line")).toBe(true);
    expect(walkLabel({ km: 0.21, walkMinutes: 3 })).toBe(
      "200 m straight line · 3+ min walk (estimate)",
    );
    expect(walkLabel({ km: 1.24, walkMinutes: 15 })).toBe(
      "1.2 km straight line · 15+ min walk (estimate)",
    );
  });
});

describe("curated places beside Atlas", () => {
  const curated = [
    {
      id: "curated:test:pub",
      name: "Synthetic pub",
      kind: "bar" as const,
      address: "1 Test St",
      neighbourhood: "Test",
      at: [49.2785, -123.1088] as const,
      blurb: "A synthetic pub.",
      source: {
        osm: "https://www.openstreetmap.org/node/1",
        checked: "2026-10-19",
      },
    },
    {
      id: "curated:test:station",
      name: "Synthetic station",
      kind: "meeting" as const,
      address: "2 Test St",
      neighbourhood: "Test",
      at: [49.278, -123.1088] as const,
      blurb: "Not food.",
      source: {
        osm: "https://www.openstreetmap.org/node/2",
        checked: "2026-10-19",
      },
    },
  ];

  it("fills in when Atlas has nothing, and says the place is curated", () => {
    const places = nearbyWithCurated([], curated, ARENA);
    expect(places.map((p) => [p.atlasId, p.source])).toEqual([
      ["curated:test:pub", "curated"],
    ]);
    expect(places[0].address).toBe("1 Test St, Test");
  });

  it("lets the Atlas record win over the curated entry for the same place", () => {
    const atlas = candidate("a1", "Pub", [-123.1088, 49.2785], "observed", {
      name: "The Synthetic Pub",
    });
    const places = nearbyWithCurated([atlas], curated, ARENA);
    expect(places.map((p) => [p.atlasId, p.source])).toEqual([["a1", "atlas"]]);
  });
});
