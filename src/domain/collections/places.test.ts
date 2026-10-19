import { describe, expect, it } from "vitest";
import { curatedNear, sameName, type CuratedPlace } from "./places";
import {
  CONVENTION_CENTRE_WEST,
  ROGERS_ARENA,
  VANCOUVER_PLACES,
} from "./vancouver";

describe("the downtown Vancouver list", () => {
  it("gives every place a stable, unique curated id", () => {
    const ids = VANCOUVER_PLACES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^curated:vancouver:[a-z0-9-]+$/);
  });

  it("says where every address and coordinate came from", () => {
    for (const p of VANCOUVER_PLACES) {
      expect(p.source.osm).toMatch(
        /^https:\/\/www\.openstreetmap\.org\/(node|way|relation)\/\d+$/,
      );
      expect(p.source.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(p.address.length).toBeGreaterThan(3);
      expect(p.blurb.length).toBeGreaterThan(10);
    }
  });

  it("places everything in Vancouver, not at 0,0 or with lat/lng swapped", () => {
    for (const { at, name } of VANCOUVER_PLACES) {
      expect([name, at[0] > 49.26 && at[0] < 49.32]).toEqual([name, true]);
      expect([name, at[1] > -123.15 && at[1] < -123.09]).toEqual([name, true]);
    }
  });

  it("covers what both Experiences need", () => {
    const kinds = new Set(VANCOUVER_PLACES.map((p) => p.kind));
    expect([...kinds].sort()).toEqual([
      "activity",
      "bar",
      "meeting",
      "restaurant",
      "venue",
    ]);
    for (const venue of [ROGERS_ARENA, CONVENTION_CENTRE_WEST]) {
      const near = curatedNear(VANCOUVER_PLACES, venue.at, {
        kinds: ["restaurant", "bar"],
        withinKm: 1.6,
      });
      expect(near.length).toBeGreaterThanOrEqual(5);
    }
  });

  it("matches OpenStreetMap's Rogers Arena to within a few metres of Hockey's venue", () => {
    const hockey: [number, number] = [49.2778, -123.1088];
    const [arena] = curatedNear([ROGERS_ARENA], hockey, { withinKm: 0.05 });
    expect(arena?.place.id).toBe("curated:vancouver:rogers-arena");
  });
});

describe("curatedNear", () => {
  const at = (id: string, lat: number): CuratedPlace => ({
    id: `curated:test:${id}`,
    name: id,
    kind: "bar",
    address: "1 Test St",
    neighbourhood: "Test",
    at: [lat, -123.1],
    blurb: "A synthetic place.",
    source: {
      osm: "https://www.openstreetmap.org/node/1",
      checked: "2026-10-19",
    },
  });

  it("filters by distance and kind, nearest first", () => {
    const places = [at("far", 49.3), at("near", 49.2802), at("mid", 49.284)];
    const got = curatedNear(places, [49.28, -123.1], { withinKm: 1 });
    expect(got.map((n) => n.place.name)).toEqual(["near", "mid"]);
    expect(got[0].walkMinutes).toBe(1);
    expect(
      curatedNear(places, [49.28, -123.1], { kinds: ["meeting"] }),
    ).toEqual([]);
  });
});

describe("sameName", () => {
  it("ignores case, punctuation, a leading The and venue words", () => {
    expect(sameName("The Blarney Stone", "Blarney Stone Pub")).toBe(true);
    expect(sameName("Tap & Barrel", "Tap and Barrel")).toBe(true);
    expect(sameName("Chambar", "Chambar Restaurant")).toBe(true);
    expect(sameName("Chambar", "Miku")).toBe(false);
  });
});
