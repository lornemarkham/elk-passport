import { describe, expect, test } from "vitest";
import type { EntityLike } from "./regionHealth";
import {
  assessPlacementReadiness,
  nameDistinguishes,
  splitByPlacementReadiness,
  usablePoint,
} from "./placementReadiness";

/**
 * The gate that decides whether asking a curator to place an entity is a
 * reasonable question. Every case below is drawn from the live Recreation
 * corpus, because a gate tested only against invented data proves the test
 * author's imagination rather than the rule.
 */

const place = (over: Partial<EntityLike> & { id: string }): EntityLike => ({
  kind: "Place",
  name: "Somewhere",
  geometry: { type: "Point", coordinates: [-119.4, 50.2] },
  ...over,
});

const osm = new Set(["openstreetmap"]);

describe("nameDistinguishes", () => {
  test("a name carrying more than its type distinguishes the thing", () => {
    expect(nameDistinguishes("Okanagan Lake Viewpoint", "viewpoint")).toBe(
      true,
    );
  });

  test("a name that is only the type distinguishes nothing", () => {
    // Two live entities are both called exactly this, 400 m apart.
    expect(nameDistinguishes("Viewpoint", "viewpoint")).toBe(false);
  });

  test("case and punctuation are not the difference", () => {
    expect(nameDistinguishes("Boat Launch", "boat launch")).toBe(false);
    expect(nameDistinguishes("Boat-Launch", "boat launch")).toBe(false);
  });

  test("an empty name distinguishes nothing", () => {
    expect(nameDistinguishes("", "viewpoint")).toBe(false);
    expect(nameDistinguishes(undefined, "viewpoint")).toBe(false);
  });

  test("with no type to compare against, any name distinguishes", () => {
    // The rule is "says more than its type", so with no type there is nothing
    // for the name to be redundant with. It must not fail closed here: that
    // would withhold every entity whose kind carries no type label.
    expect(nameDistinguishes("Monashee Mountains", undefined)).toBe(true);
  });
});

describe("usablePoint", () => {
  test("reads a real coordinate pair", () => {
    expect(usablePoint({ type: "Point", coordinates: [-119.4, 50.2] })).toEqual(
      [-119.4, 50.2],
    );
  });

  test("refuses 0, 0 — a failed read is not a location", () => {
    // Kalamalka Lake Park sits at exactly this in the live corpus.
    expect(usablePoint({ type: "Point", coordinates: [0, 0] })).toBeUndefined();
  });

  test("refuses a non-point geometry rather than guessing a centroid", () => {
    expect(
      usablePoint({ type: "Polygon", coordinates: [[[0, 1]]] }),
    ).toBeUndefined();
  });

  test("refuses missing, non-numeric and infinite values", () => {
    expect(usablePoint(undefined)).toBeUndefined();
    expect(
      usablePoint({ type: "Point", coordinates: ["50", "119"] }),
    ).toBeUndefined();
    expect(
      usablePoint({ type: "Point", coordinates: [Infinity, 50] }),
    ).toBeUndefined();
  });
});

describe("assessPlacementReadiness", () => {
  test("a named, located, described place is ready", () => {
    const result = assessPlacementReadiness(
      place({
        id: "a",
        name: "Kekuli Bay Provincial Park",
        placeType: "provincial park",
      }),
      osm,
    );
    expect(result.ready).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.nextOperation).toBeUndefined();
    expect(result.because).toContain("Kekuli Bay Provincial Park");
  });

  test("a place named only for its type is withheld, and says why", () => {
    const result = assessPlacementReadiness(
      place({ id: "b", name: "Viewpoint", placeType: "viewpoint" }),
      osm,
    );
    expect(result.ready).toBe(false);
    expect(result.missing.map((m) => m.requirement)).toEqual(["identified"]);
    expect(result.because).toContain("only its type");
    expect(result.nextOperation).toContain("names it");
  });

  test("a first-party URL stands in for a distinguishing name", () => {
    // The thing publishes a page about itself: that page names it, and a
    // curator can open it.
    const result = assessPlacementReadiness(
      place({
        id: "c",
        name: "Viewpoint",
        placeType: "viewpoint",
        externalIds: [{ system: "first-party-url" }],
      }),
      osm,
    );
    expect(result.ready).toBe(true);
  });

  test("a canonical external id does not stand in for a name", () => {
    // Every OSM feature has one by construction, so accepting it would admit
    // every row and decide nothing — the failure that removed
    // `deterministic-parent` from the identity signals.
    const result = assessPlacementReadiness(
      place({
        id: "d",
        name: "Boat Launch",
        placeType: "boat launch",
        externalIds: [{ system: "openstreetmap" }],
      }),
      osm,
    );
    expect(result.ready).toBe(false);
    expect(result.missing.map((m) => m.requirement)).toEqual(["identified"]);
  });

  test("0, 0 withholds a well-named park, and names the reason", () => {
    const result = assessPlacementReadiness(
      place({
        id: "e",
        name: "Kalamalka Lake Park",
        placeType: "park",
        geometry: { type: "Point", coordinates: [0, 0] },
      }),
      osm,
    );
    expect(result.ready).toBe(false);
    expect(result.missing.map((m) => m.requirement)).toEqual(["located"]);
    expect(result.because).toContain("failed read");
  });

  test("an address is a location when coordinates are absent", () => {
    const result = assessPlacementReadiness(
      place({
        id: "f",
        name: "Predator Ridge Resort",
        placeType: "golf resort",
        geometry: undefined,
        address: "301 Village Centre Pl, Vernon BC",
      }),
      osm,
    );
    expect(result.ready).toBe(true);
  });

  test("nothing describing it withholds it, whatever else is known", () => {
    const result = assessPlacementReadiness(
      place({ id: "g", name: "Evely Campground", placeType: "campground" }),
      new Set(),
    );
    expect(result.ready).toBe(false);
    expect(result.missing.map((m) => m.requirement)).toEqual(["attributed"]);
    expect(result.nextOperation).toContain("provenance");
  });

  test("publishers are counted distinctly and reported in a stable order", () => {
    // ADR 036: independence is counted in publishers, not records.
    const result = assessPlacementReadiness(
      place({
        id: "h",
        name: "Silver Star Provincial Park",
        placeType: "provincial park",
      }),
      new Set(["openstreetmap", "bc-parks"]),
    );
    expect(result.publishers).toEqual(["bc-parks", "openstreetmap"]);
  });

  test("every failure is reported, not just the first", () => {
    const result = assessPlacementReadiness(
      place({
        id: "i",
        name: "Viewpoint",
        placeType: "viewpoint",
        geometry: { type: "Point", coordinates: [0, 0] },
      }),
      new Set(),
    );
    expect(result.missing.map((m) => m.requirement)).toEqual([
      "identified",
      "located",
      "attributed",
    ]);
  });

  test("is deterministic — the same entity assessed twice reads the same", () => {
    const entity = place({ id: "j", name: "Kal Beach", placeType: "beach" });
    expect(assessPlacementReadiness(entity, osm)).toEqual(
      assessPlacementReadiness(entity, osm),
    );
  });

  test("carries no score, percentage or confidence anywhere in its output", () => {
    const result = assessPlacementReadiness(
      place({ id: "k", name: "Kal Beach", placeType: "beach" }),
      osm,
    );
    const keys = Object.keys(result);
    expect(keys).not.toContain("score");
    expect(keys).not.toContain("confidence");
    expect(JSON.stringify(result)).not.toMatch(/%/);
  });
});

describe("splitByPlacementReadiness", () => {
  const entities: EntityLike[] = [
    place({
      id: "1",
      name: "Okanagan Mountain Provincial Park",
      placeType: "park",
    }),
    place({ id: "2", name: "Viewpoint", placeType: "viewpoint" }),
    place({
      id: "3",
      name: "Kalamalka Lake Park",
      placeType: "park",
      geometry: { type: "Point", coordinates: [0, 0] },
    }),
  ];
  const publishers = new Map([
    ["1", osm],
    ["2", osm],
    ["3", osm],
  ]);

  test("splits the population without losing anyone", () => {
    const split = splitByPlacementReadiness(entities, publishers);
    expect(split.all).toHaveLength(3);
    expect(split.ready.map((r) => r.entityId)).toEqual(["1"]);
    expect(split.withheld.map((r) => r.entityId)).toEqual(["2", "3"]);
    // The whole point: withheld are counted and named, never dropped. A gate
    // that quietly shrank the list would look exactly like one that worked.
    expect(split.ready.length + split.withheld.length).toBe(split.all.length);
  });

  test("an entity with no publisher entry is withheld, not assumed described", () => {
    const split = splitByPlacementReadiness(entities, new Map());
    expect(split.ready).toEqual([]);
  });

  test("preserves input order, so the surface is stable between reads", () => {
    const split = splitByPlacementReadiness(entities, publishers);
    expect(split.all.map((r) => r.entityId)).toEqual(["1", "2", "3"]);
  });
});
