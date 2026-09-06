import { describe, expect, it } from "vitest";
import {
  matchesScope,
  scopeExperiences,
  scopeLabel,
  type GeographicScope,
} from "./geographicScope";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import { destinationFor } from "@/domain/experience/destination";
import { defaultFeed } from "./defaultFeed";
import { matchesQuery } from "./selectors";
import type { DiscoveryCandidate } from "@/lib/data/types";

// Fixtures, never live regions.
const OKANAGAN = "region-okanagan";
const VANCOUVER = "region-vancouver";
const okanaganScope: GeographicScope = {
  kind: "atlas-region",
  regionId: OKANAGAN,
  label: "Okanagan",
};
const vancouverScope: GeographicScope = {
  kind: "atlas-region",
  regionId: VANCOUVER,
  label: "Vancouver",
};

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
    expect(experience({ regionIds: [] }).regionIds).toEqual([]);
  });
});

describe("an atlas-region scope", () => {
  it("reads membership Atlas asserted, never coordinates", () => {
    // The Okanagan fixture and the Vancouver fixture carry identical
    // coordinates. Only the asserted membership separates them — which is the
    // whole point: Passport must never re-derive region membership from a
    // point, because that is the bounding-box inference ADR 025 rejects.
    const sameSpotElsewhere = experience({
      id: "elsewhere",
      coordinates: [-119.4, 50.1],
      regionIds: [VANCOUVER],
    });
    expect(matchesScope(sameSpotElsewhere, okanaganScope)).toBe(false);
  });

  it("excludes an entity that belongs only to another region", () => {
    expect(ids(scopeExperiences(all, okanaganScope))).toEqual([
      "both",
      "ellison",
    ]);
  });

  it("the other region excludes the Okanagan-only entity", () => {
    expect(ids(scopeExperiences(all, vancouverScope))).toEqual([
      "both",
      "stanley",
    ]);
  });

  it("an entity in two regions appears under both", () => {
    expect(matchesScope(both, okanaganScope)).toBe(true);
    expect(matchesScope(both, vancouverScope)).toBe(true);
  });

  it("an unplaced entity is never adopted by whichever scope is active", () => {
    expect(matchesScope(unplaced, okanaganScope)).toBe(false);
    expect(ids(scopeExperiences(all, okanaganScope))).not.toContain("unplaced");
  });

  it("no scope means everywhere", () => {
    expect(ids(scopeExperiences(all, undefined))).toEqual(ids(all));
    expect(matchesScope(unplaced, undefined)).toBe(true);
  });

  it("scope and the feed policy compose — scope first, then policy", () => {
    expect(ids(defaultFeed(scopeExperiences(all, okanaganScope)))).toEqual([
      "both",
      "ellison",
    ]);
  });
});

describe("search obeys the same scope", () => {
  it("finds an in-scope match", () => {
    expect(
      ids(
        scopeExperiences(all, okanaganScope).filter((e) =>
          matchesQuery(e, "Park"),
        ),
      ),
    ).toEqual(["ellison"]);
  });

  it("does not surface another region's entity through search", () => {
    // Search widens the pool past the default feed, never past the scope.
    expect(
      scopeExperiences(all, okanaganScope).filter((e) =>
        matchesQuery(e, "Stanley"),
      ),
    ).toEqual([]);
    expect(matchesQuery(stanley, "Stanley")).toBe(true);
  });
});

describe("the scope kinds that do not exist yet", () => {
  it("refuses to answer rather than guessing", () => {
    // Declared so the seam is provably general; unimplemented, and loud about
    // it. Returning `false` would silently hide half a corpus; returning `true`
    // would silently show all of it.
    const radius: GeographicScope = {
      kind: "radius",
      centre: [-119.4, 50.1],
      km: 20,
      label: "Within 20 km",
    };
    expect(() => matchesScope(ellison, radius)).toThrow(/no evaluator yet/);
  });

  it("carries a label like every other scope, so the UI needs no special case", () => {
    const viewport: GeographicScope = {
      kind: "bounding-box",
      southWest: [-120, 49],
      northEast: [-118, 51],
      label: "This map",
    };
    expect(scopeLabel(viewport)).toBe("This map");
    expect(scopeLabel(okanaganScope)).toBe("Okanagan");
    expect(scopeLabel(undefined)).toBeUndefined();
  });
});

describe("detail and saving are scope-independent", () => {
  it("a direct detail URL is unaffected by the active scope", () => {
    expect(destinationFor(stanley)).toBe("/places/stanley");
  });

  it("an entity keeps one identity across scopes, so a board saves it once", () => {
    expect(scopeExperiences([both], okanaganScope)[0]?.id).toBe(both.id);
    expect(scopeExperiences([both], vancouverScope)[0]?.id).toBe(both.id);
  });
});
