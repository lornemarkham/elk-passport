import { describe, expect, it } from "vitest";
import {
  EDITORIAL_COLLECTIONS,
  collectionBySlug,
  resolveCollection,
  type EditorialCollection,
} from "./editorial";
import { throughLens } from "@/domain/october/areas";
import { areaById } from "@/domain/october/areas";
import type { Experience } from "@/domain/experience/types";

const thing = (
  id: string,
  title: string,
  extra: Partial<Experience> = {},
): Experience =>
  ({
    id,
    kind: "Experience",
    slug: id,
    title,
    shortDescription: "",
    detailReady: false,
    moods: [],
    activities: [],
    seasons: [],
    timeOfDay: [],
    weather: [],
    companions: [],
    energyLevel: 3,
    priceLevel: 1,
    duration: { minMinutes: 0, maxMinutes: 0 },
    ...extra,
  }) as unknown as Experience;

const collection = (
  members: { atlasEntityId: string; atlasEntityKind: "Experience" }[],
): EditorialCollection => ({ slug: "test", name: "Test", members });

describe("collection identity", () => {
  it("resolves a collection by its slug", () => {
    const found = collectionBySlug("okanagan-halloween-2026");
    expect(found?.name).toBe("Okanagan Halloween 2026");
  });

  it("has no answer for a slug nobody stated", () => {
    expect(collectionBySlug("vancouver-hockey")).toBeUndefined();
  });

  it("keeps slugs unique, so a slug can never be ambiguous", () => {
    const slugs = EDITORIAL_COLLECTIONS.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("stores only an Atlas id and kind — never a copied fact", () => {
    for (const c of EDITORIAL_COLLECTIONS) {
      for (const m of c.members) {
        expect(Object.keys(m).sort()).toEqual([
          "atlasEntityId",
          "atlasEntityKind",
        ]);
      }
    }
  });
});

describe("resolving members", () => {
  const usher = thing("exp-usher", "The Fall of the House of Usher");
  const bmhh = thing("exp-bmhh", "The Black Mountain Haunted House");

  it("returns live Atlas Things in the collection's own order", () => {
    const resolved = resolveCollection(
      collection([
        { atlasEntityId: "exp-bmhh", atlasEntityKind: "Experience" },
        { atlasEntityId: "exp-usher", atlasEntityKind: "Experience" },
      ]),
      [usher, bmhh],
    );
    // Order follows the collection, not the order Atlas happened to return.
    expect(resolved.members.map((m) => m.id)).toEqual([
      "exp-bmhh",
      "exp-usher",
    ]);
    expect(resolved.missing).toEqual([]);
  });

  it("drops a member Atlas no longer supplies, and says which", () => {
    const resolved = resolveCollection(
      collection([
        { atlasEntityId: "exp-usher", atlasEntityKind: "Experience" },
        { atlasEntityId: "exp-retired", atlasEntityKind: "Experience" },
      ]),
      [usher],
    );
    // Degrades to absence rather than to a name Passport remembers: with no
    // Atlas record there is nothing Passport could truthfully say about it.
    expect(resolved.members.map((m) => m.id)).toEqual(["exp-usher"]);
    expect(resolved.missing).toEqual(["exp-retired"]);
  });

  it("resolves an empty collection to nothing, not an error", () => {
    expect(resolveCollection(collection([]), [usher])).toEqual({
      members: [],
      missing: [],
    });
  });

  it("lists a Thing once even if membership states it twice", () => {
    const resolved = resolveCollection(
      collection([
        { atlasEntityId: "exp-usher", atlasEntityKind: "Experience" },
        { atlasEntityId: "exp-usher", atlasEntityKind: "Experience" },
      ]),
      [usher],
    );
    expect(resolved.members).toHaveLength(1);
  });

  it("survives Atlas being unreachable", () => {
    const resolved = resolveCollection(
      collection([
        { atlasEntityId: "exp-usher", atlasEntityKind: "Experience" },
      ]),
      [],
    );
    expect(resolved.members).toEqual([]);
    expect(resolved.missing).toEqual(["exp-usher"]);
  });
});

describe("membership is independent of keyword score", () => {
  const haunts = areaById("events-haunts")!;
  // Verbatim from Atlas. Contains none of the lens terms — which is the whole
  // reason this primitive exists.
  const usher = thing("exp-usher", "The Fall of the House of Usher", {
    shortDescription:
      "Take an immersive journey to the house of the Ushers, in this fresh adaptation of Edgar Allan Poe's short story.",
  });

  it("the lens cannot find Usher — this is the failure being fixed", () => {
    expect(throughLens([usher], haunts)).toEqual([]);
  });

  it("but stated membership surfaces it anyway", () => {
    const resolved = resolveCollection(
      collection([
        { atlasEntityId: "exp-usher", atlasEntityKind: "Experience" },
      ]),
      [usher],
    );
    expect(resolved.members.map((m) => m.title)).toEqual([
      "The Fall of the House of Usher",
    ]);
  });

  it("and a high-scoring Thing does not get in without being stated", () => {
    const loud = thing("org-haunt", "Haunted Haunted Ghost Festival", {
      shortDescription: "spooky horror scare",
    });
    // It dominates the lens…
    expect(throughLens([loud, usher], haunts).map((e) => e.id)).toEqual([
      "org-haunt",
    ]);
    // …and is still absent from a collection nobody put it in.
    const resolved = resolveCollection(
      collection([
        { atlasEntityId: "exp-usher", atlasEntityKind: "Experience" },
      ]),
      [loud, usher],
    );
    expect(resolved.members.map((m) => m.id)).toEqual(["exp-usher"]);
  });
});

describe("the seeded collection", () => {
  it("binds to the Events & Haunts area, which therefore stops inferring", () => {
    const haunts = areaById("events-haunts")!;
    expect(haunts.collectionSlug).toBe("okanagan-halloween-2026");
    expect(collectionBySlug(haunts.collectionSlug!)).toBeDefined();
  });

  it("names the real Atlas ids it was seeded with", () => {
    const seeded = collectionBySlug("okanagan-halloween-2026")!;
    expect(seeded.members.map((m) => m.atlasEntityId)).toEqual([
      "exp-black-mountain-haunted-house",
      "exp-usher-caravan-farm-theatre",
    ]);
  });
});
