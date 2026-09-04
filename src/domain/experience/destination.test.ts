import { describe, expect, it } from "vitest";
import { destinationFor } from "./destination";
import { candidateToExperience } from "./atlasMapper";
import type { DiscoveryCandidate } from "@/lib/data/types";

const candidate = (over: Partial<DiscoveryCandidate>): DiscoveryCandidate => ({
  id: "id-1",
  kind: "Place",
  name: "Somewhere",
  description: "A description long enough to be real.",
  mediaCount: 0,
  containsCount: 0,
  regionIds: [],
  ...over,
});

describe("destinationFor", () => {
  it("sends a detail-ready Place to its own page", () => {
    const experience = candidateToExperience(
      candidate({
        kind: "Place",
        name: "Ellison Park",
        heroUrl: "https://example.com/ellison.jpg",
        coordinates: [-119.44, 50.18],
      }),
    );
    expect(experience.detailReady).toBe(true);
    expect(destinationFor(experience)).toBe("/places/id-1");
  });

  it("never sends an Organization to /places/{organizationId}", () => {
    const experience = candidateToExperience(
      candidate({
        id: "org-bullwheel",
        kind: "Organization",
        name: "The BullWheel",
      }),
    );
    expect(destinationFor(experience)).not.toBe("/places/org-bullwheel");
  });

  it("sends an Organization to the Place that physically contains it, when Atlas says so", () => {
    const experience = candidateToExperience(
      candidate({
        id: "org-bullwheel",
        kind: "Organization",
        name: "The BullWheel",
        context: {
          id: "place-bigwhite",
          kind: "Place",
          name: "Big White Ski Resort",
        },
      }),
    );
    expect(destinationFor(experience)).toBe("/places/place-bigwhite");
  });

  it("never sends an Activity to /places/{activityId}", () => {
    const experience = candidateToExperience(
      candidate({
        id: "activity-night-skiing",
        kind: "Activity",
        name: "night skiing",
      }),
    );
    expect(destinationFor(experience)).not.toBe(
      "/places/activity-night-skiing",
    );
    // No context in the corpus for this one, so there is nowhere truthful to go.
    expect(destinationFor(experience)).toBeUndefined();
  });

  it("gives a candidate with nowhere truthful to go no destination at all", () => {
    // A card without a link is a real outcome. Eligibility and having a
    // destination are separate questions — hence no `hasDetailPage` flag.
    const experience = candidateToExperience(
      candidate({ kind: "Event", name: "Saturday Night Fireworks" }),
    );
    expect(destinationFor(experience)).toBeUndefined();
  });

  it("does not send a Place that is not detail-ready to a page it cannot fill", () => {
    const experience = candidateToExperience(
      candidate({
        kind: "Place",
        name: "Kekuli Bay Provincial Park",
        coordinates: [-119.34, 50.18],
      }),
    );
    expect(experience.detailReady).toBe(false);
    expect(destinationFor(experience)).toBeUndefined();
  });
});

describe("candidateToExperience", () => {
  it("keeps candidacy independent of detail readiness", () => {
    const experience = candidateToExperience(
      candidate({ kind: "Activity", name: "night skiing", subtype: "skiing" }),
    );
    // It became an Experience — i.e. it is a candidate — while having nowhere
    // near enough content for a page.
    expect(experience.kind).toBe("Activity");
    expect(experience.detailReady).toBe(false);
  });

  it("carries the subtype and the context Atlas derived, and invents no attributes", () => {
    const experience = candidateToExperience(
      candidate({
        kind: "Organization",
        subtype: "restaurant",
        context: {
          id: "place-bigwhite",
          kind: "Place",
          name: "Big White Ski Resort",
        },
      }),
    );
    expect(experience.subtype).toBe("restaurant");
    expect(experience.context?.name).toBe("Big White Ski Resort");
    // The fabricated attributes are gone: no invented season, companions,
    // duration or pet policy.
    expect(experience.seasons).toEqual([]);
    expect(experience.companions).toEqual([]);
    expect(experience.duration).toEqual({ minMinutes: 0, maxMinutes: 0 });
  });

  it("has no tier", () => {
    const experience = candidateToExperience(candidate({}));
    expect("tier" in experience).toBe(false);
  });
});
