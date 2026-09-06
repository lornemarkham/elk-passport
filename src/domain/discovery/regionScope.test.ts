import { describe, expect, it } from "vitest";
import { activeRegionId, inRegion, scopeToRegion } from "./regionScope";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import { destinationFor } from "@/domain/experience/destination";
import { defaultFeed } from "./defaultFeed";
import { matchesQuery } from "./selectors";
import type { DiscoveryCandidate } from "@/lib/data/types";

// Fixtures, never live regions. Atlas has exactly one region today and these
// prove behaviour that only shows up when it has two.
const OKANAGAN = "region-okanagan";
const VANCOUVER = "region-vancouver";

const candidate = (over: Partial<DiscoveryCandidate>): DiscoveryCandidate => ({
  id: "id-1",
  kind: "Place",
  name: "Somewhere",
  description: "A description long enough to be real.",
  subtype: "park",
  heroUrl: "https://example.com/p.jpg",
  coordinates: [-119.4, 50.1],
  mediaCount: 0,
  containsCount: 0,
  regionIds: [],
  ...over,
});
const experience = (over: Partial<DiscoveryCandidate>) =>
  candidateToExperience(candidate(over));

const ellison = experience({
  id: "ellison",
  name: "Ellison Park",
  regionIds: [OKANAGAN],
});
const stanley = experience({
  id: "stanley",
  name: "Stanley Park",
  regionIds: [VANCOUVER],
});
const both = experience({
  id: "both",
  name: "Coquihalla Summit",
  regionIds: [OKANAGAN, VANCOUVER],
});
const unplaced = experience({
  id: "unplaced",
  name: "Mt Moore",
  regionIds: [],
});
const all = [ellison, stanley, both, unplaced];
const ids = (xs: readonly { id: string }[]) => xs.map((x) => x.id).sort();

describe("regionIds survive the Atlas mapping", () => {
  it("carries exactly what Atlas served", () => {
    expect(experience({ regionIds: [OKANAGAN, VANCOUVER] }).regionIds).toEqual([
      OKANAGAN,
      VANCOUVER,
    ]);
  });

  it("an entity Atlas placed nowhere arrives with none, not with a default", () => {
    // The failure this whole seam exists to prevent: 136 of Atlas's 200
    // entities are in no region, and none of them is Okanagan.
    expect(experience({ regionIds: [] }).regionIds).toEqual([]);
  });
});

describe("the seam", () => {
  it("says no region today, which means no scope", () => {
    // Deliberately not "default to the Okanagan" — Passport must never hold the
    // assumption that its one region is the product.
    expect(activeRegionId()).toBeUndefined();
  });

  it("shows everything when no region is active, which is today's behaviour", () => {
    expect(ids(scopeToRegion(all, undefined))).toEqual(ids(all));
  });
});

describe("discovery scope", () => {
  it("an Okanagan scope excludes an entity that belongs only to another region", () => {
    expect(ids(scopeToRegion(all, OKANAGAN))).toEqual(["both", "ellison"]);
  });

  it("another region's scope excludes the Okanagan-only entity", () => {
    expect(ids(scopeToRegion(all, VANCOUVER))).toEqual(["both", "stanley"]);
  });

  it("an entity in two regions appears under both", () => {
    expect(inRegion(both, OKANAGAN)).toBe(true);
    expect(inRegion(both, VANCOUVER)).toBe(true);
  });

  it("an unplaced entity is never adopted by whichever region is active", () => {
    expect(inRegion(unplaced, OKANAGAN)).toBe(false);
    expect(inRegion(unplaced, VANCOUVER)).toBe(false);
    expect(ids(scopeToRegion(all, OKANAGAN))).not.toContain("unplaced");
  });

  it("scope and the feed policy compose — scope first, then the policy", () => {
    const feed = defaultFeed(scopeToRegion(all, OKANAGAN));
    expect(ids(feed)).toEqual(["both", "ellison"]);
  });
});

describe("search obeys the same scope", () => {
  it("finds an in-region match", () => {
    const hits = scopeToRegion(all, OKANAGAN).filter((e) =>
      matchesQuery(e, "Park"),
    );
    expect(ids(hits)).toEqual(["ellison"]);
  });

  it("does not surface another region's entity through search", () => {
    // Stanley Park matches the query and must still not appear: search widens
    // the pool past the default feed, never past the region.
    const hits = scopeToRegion(all, OKANAGAN).filter((e) =>
      matchesQuery(e, "Stanley"),
    );
    expect(hits).toEqual([]);
    expect(matchesQuery(stanley, "Stanley")).toBe(true);
  });
});

describe("detail and saving are region-independent", () => {
  it("a direct detail URL is unaffected by which region is active", () => {
    // Region scope belongs to browsing. A shared link must open whatever the
    // reader's active region happens to be.
    expect(destinationFor(stanley)).toBe("/places/stanley");
    expect(destinationFor(ellison)).toBe("/places/ellison");
  });

  it("an entity keeps one identity across regions, so a board saves it once", () => {
    // Board items store an entity id and nothing about regions, which is what
    // keeps a saved item stable when scope changes.
    expect(both.id).toBe("both");
    expect(scopeToRegion([both], OKANAGAN)[0]?.id).toBe(both.id);
    expect(scopeToRegion([both], VANCOUVER)[0]?.id).toBe(both.id);
  });
});
