import { describe, expect, it } from "vitest";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import type { DiscoveryCandidate } from "@/lib/data/types";
import { happeningInOctober, lastOctober, octoberLanes } from "./octoberLanes";

/**
 * **A Thing joins an October lane because of what Atlas says it is.**
 *
 * Kind, subtype, dates. Never a word in its description. These pin the four
 * ways that could quietly go wrong: an accidental keyword, an event that has
 * already ended, last year's haunts passed off as this year's, and a Thing
 * appearing in two lanes at once.
 */
const NOW = new Date("2026-10-10T12:00:00Z");

const thing = (over: Partial<DiscoveryCandidate>): DiscoveryCandidate => ({
  id: over.name?.toLowerCase().replace(/\W+/g, "-") ?? "id",
  kind: "Organization",
  name: "Somewhere",
  description: "A description long enough to be real.",
  mediaCount: 0,
  containsCount: 0,
  regionIds: [],
  ...over,
});
const ex = (list: DiscoveryCandidate[]) => list.map(candidateToExperience);

describe("what makes a lane", () => {
  it("is the subtype, not the prose", () => {
    const lanes = octoberLanes(
      ex([
        // A winery whose blurb is all Halloween is still a winery.
        thing({
          name: "Spooky Cellars",
          subtype: "winery",
          description: "Our haunted house Halloween pumpkin scare night!",
        }),
        thing({ name: "Real Haunt", subtype: "haunted house" }),
      ]),
      NOW,
    );
    const scares = lanes.find((l) => l.id === "scares")!;
    expect(scares.experiences.map((e) => e.title)).toEqual(["Real Haunt"]);
  });

  it("puts a Thing in at most one lane", () => {
    // A subtype that two rules could claim lands in the first that does.
    const lanes = octoberLanes(
      ex([
        thing({ name: "Corn Co", subtype: "corn maze" }),
        thing({ name: "A", subtype: "farm" }),
        thing({ name: "B", subtype: "farm" }),
        thing({ name: "C", subtype: "orchard" }),
      ]),
      NOW,
    );
    const appearances = lanes
      .flatMap((l) => l.experiences.map((e) => e.title))
      .filter((t) => t === "Corn Co");
    expect(appearances).toHaveLength(1);
  });

  it("omits a lane below its minimum rather than showing it thin", () => {
    const lanes = octoberLanes(
      ex([thing({ name: "One", subtype: "winery" })]),
      NOW,
    );
    expect(lanes.find((l) => l.id === "cider")).toBeUndefined();
  });

  it("is deterministic", () => {
    const pool = ex([
      thing({ name: "A", subtype: "museum" }),
      thing({ name: "B", subtype: "museum" }),
      thing({ name: "C", subtype: "heritage park", kind: "Place" }),
    ]);
    expect(octoberLanes(pool, NOW)).toEqual(octoberLanes(pool, NOW));
  });
});

describe("events", () => {
  it("promotes only what has not already ended", () => {
    const list = happeningInOctober(
      ex([
        thing({
          name: "Over",
          kind: "Event",
          subtype: "festival",
          startTime: "2026-10-01T00:00:00Z",
          endTime: "2026-10-03T00:00:00Z",
        }),
        thing({
          name: "On",
          kind: "Event",
          subtype: "festival",
          startTime: "2026-10-01T00:00:00Z",
          endTime: "2026-10-31T00:00:00Z",
        }),
        thing({
          name: "Ahead",
          kind: "Event",
          subtype: "concert",
          startTime: "2026-10-24T00:00:00Z",
        }),
        thing({
          name: "November",
          kind: "Event",
          subtype: "concert",
          startTime: "2026-11-02T00:00:00Z",
        }),
      ]),
      NOW,
    );
    expect(list.map((e) => e.title)).toEqual(["On", "Ahead"]);
  });

  it("never promotes a hiring event as something to do", () => {
    const list = happeningInOctober(
      ex([
        thing({
          name: "Staff wanted",
          kind: "Event",
          subtype: "Hiring Event",
          startTime: "2026-10-05T00:00:00Z",
          endTime: "2027-06-01T00:00:00Z",
        }),
      ]),
      NOW,
    );
    expect(list).toEqual([]);
  });

  it("keeps last year's haunts in their own lane, marked, never as upcoming", () => {
    const pool = ex([
      thing({
        name: "Haunted Corn Maze",
        kind: "Event",
        subtype: "haunted maze",
        startTime: "2025-10-09T00:00:00Z",
        endTime: "2025-11-02T00:00:00Z",
      }),
      thing({ name: "A Haunt", subtype: "haunted house" }),
    ]);
    expect(happeningInOctober(pool, NOW)).toEqual([]);
    expect(lastOctober(pool).map((e) => e.title)).toEqual([
      "Haunted Corn Maze",
    ]);

    const lanes = octoberLanes(pool, NOW);
    const last = lanes.find((l) => l.id === "last-october")!;
    expect(last.lastYear).toBe(true);
    expect(lanes.find((l) => l.id === "happening")).toBeUndefined();
  });

  it("does not make a jazz quartet a Halloween event because it is in October", () => {
    const pool = ex([
      thing({
        name: "Quartet",
        kind: "Event",
        subtype: "Music Performance",
        startTime: "2026-10-18T00:00:00Z",
      }),
    ]);
    expect(lastOctober(pool)).toEqual([]);
    // It is, honestly, happening in October.
    expect(happeningInOctober(pool, NOW).map((e) => e.title)).toEqual([
      "Quartet",
    ]);
  });
});
