import { describe, expect, it } from "vitest";
import type { Experience } from "@/domain/experience/types";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import { destinationFor } from "@/domain/experience/destination";
import { scopeExperiences } from "./geographicScope";
import { rankByQuery } from "./searchRank";
import { matchesQuery } from "./selectors";
import { filterExperiences } from "./filterExperiences";
import { createEmptyFilterState } from "./types";

/**
 * The list's pipeline around the ranker (M10), in the order
 * `DiscoveryListView` runs it: scope → filters → kind → rank → saved. What is
 * pinned is that the ranker changed matching and order and nothing else:
 * scope still bounds it, kind still bounds it, saved items still leave, and
 * whether a row can be opened is untouched by how it was found.
 */

const okanagan = "region-okanagan";
const candidate = (
  id: string,
  name: string,
  over: Partial<Parameters<typeof candidateToExperience>[0]> = {},
) =>
  candidateToExperience({
    id,
    kind: "Place",
    name,
    description: `${name}, a place.`,
    mediaCount: 1,
    heroUrl: "https://example.test/x.jpg",
    coordinates: [-119.4, 50],
    containsCount: 0,
    regionIds: [okanagan],
    ...over,
  });

const knoxPark = candidate("knox-park", "Knox Mountain Park");
const knox = candidate("knox", "Knox Mountain");
const stanley = candidate("stanley", "Stanley Park", {
  regionIds: ["region-vancouver"],
});
const kalPark = candidate("kal-park", "Kalamalka Lake Park", {
  aliases: ["Kalamalka Lake Provincial Park"],
});
const unready = candidate("thin", "Knox Mountain Lookout", {
  heroUrl: undefined,
  mediaCount: 0,
});
const bullwheel = candidateToExperience({
  id: "org",
  kind: "Organization",
  name: "Knox Mountain Park Café",
  description: "A café.",
  mediaCount: 0,
  containsCount: 0,
  regionIds: [okanagan],
});
const all: Experience[] = [
  stanley,
  unready,
  bullwheel,
  knox,
  knoxPark,
  kalPark,
];
const scope = {
  kind: "atlas-region" as const,
  regionId: okanagan,
  label: "Okanagan",
};

const pipeline = (
  query: string,
  kind?: Experience["kind"],
  saved = new Set<string>(),
) =>
  rankByQuery(
    filterExperiences(
      scopeExperiences(all, scope),
      createEmptyFilterState(),
    ).filter((e) => (kind ? e.kind === kind : true)),
    query,
  ).filter((e) => !saved.has(e.id));

describe("the ranker inside the list pipeline", () => {
  it("aliases arrive from the candidate and match as names", () => {
    expect(kalPark.aliases).toEqual(["Kalamalka Lake Provincial Park"]);
    expect(pipeline("Kalamalka Lake Provincial Park")[0]?.id).toBe("kal-park");
  });

  it("scope bounds the search: an out-of-region exact name never appears", () => {
    expect(pipeline("Stanley Park")).toEqual([]);
    expect(matchesQuery(stanley, "Stanley Park")).toBe(true);
  });

  it("ranks Knox Mountain Park first for 'Knox Mountain Park first', and keeps the kind filter", () => {
    // The park explains the most of the query (T1, three tokens); the mountain
    // is a full name too (T1, two); the lookout and the café are weak (T3, in
    // arriving order) — a longer name the query does not fully contain is not
    // a stronger match for containing the query's words.
    expect(pipeline("Knox Mountain Park first").map((e) => e.id)).toEqual([
      "knox-park",
      "knox",
      "thin",
      "org",
    ]);
    expect(
      pipeline("Knox Mountain Park first", "Organization").map((e) => e.id),
    ).toEqual(["org"]);
  });

  it("saved items leave the list after ranking, without changing the order of the rest", () => {
    expect(
      pipeline(
        "Knox Mountain Park first",
        undefined,
        new Set(["knox-park"]),
      ).map((e) => e.id),
    ).toEqual(["knox", "thin", "org"]);
  });

  it("how a row was found never decides whether it can be opened", () => {
    for (const q of ["Knox Mountain Park first", "Knox", "Mountain Knox"]) {
      for (const e of pipeline(q)) {
        expect(destinationFor(e)).toBe(
          destinationFor(all.find((x) => x.id === e.id)!),
        );
      }
    }
    // Readiness chooses which page, not whether there is one.
    expect(destinationFor(unready)).toBe("/passport/thin");
    expect(destinationFor(knoxPark)).toBe("/places/knox-park");
  });

  it("an empty query is the pool, unchanged", () => {
    expect(pipeline("").map((e) => e.id)).toEqual([
      "thin",
      "org",
      "knox",
      "knox-park",
      "kal-park",
    ]);
  });
});
